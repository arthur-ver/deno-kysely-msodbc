import { CompiledQuery, QueryResult } from "kysely";
import {
  bufToStr,
  CType,
  HandleType,
  type OdbcLib,
  SQL_NO_TOTAL,
  SQL_NTS,
  SQL_NULL_DATA,
  SQLRETURN,
  SQLType,
  strToBuf,
} from "./odbc.ts";

const MAX_BIND_SIZE = 4096n; // 4kb

type ColBinding = {
  colNumber: number;
  isBound: boolean;
  cType: CType;
  buf:
    | Uint8Array<ArrayBuffer>
    | Int16Array<ArrayBuffer>
    | Int32Array<ArrayBuffer>
    | BigInt64Array<ArrayBuffer>
    | Float64Array<ArrayBuffer>
    | Uint16Array<ArrayBuffer>;
  bufLen: bigint;
  lenIndBuf: BigInt64Array<ArrayBuffer>;
};

type ParamBinding = {
  cType: CType;
  sqlType: SQLType;
  buf:
    | Int32Array<ArrayBuffer>
    | BigInt64Array<ArrayBuffer>
    | Uint8Array<ArrayBuffer>
    | Float64Array<ArrayBuffer>;
  colSize: bigint;
  decimalDigits: number;
  bufLen: bigint;
  lenIndBuf: BigInt64Array<ArrayBuffer>;
};

export class OdbcRequest<R> {
  readonly #odbcLib: OdbcLib;
  readonly #compiledQuery: CompiledQuery;
  readonly #dbcHandle: Deno.PointerValue;
  readonly #rows: R[] = [];
  readonly #paramBindings: Map<number, ParamBinding> = new Map();
  readonly #colBindings: Map<string, ColBinding> = new Map();

  #stmtHandle: Deno.PointerValue = null;

  constructor(
    odbcLib: OdbcLib,
    compiledQuery: CompiledQuery,
    dbcHandle: Deno.PointerValue,
  ) {
    this.#odbcLib = odbcLib;
    this.#compiledQuery = compiledQuery;
    this.#dbcHandle = dbcHandle;
  }

  async execute(): Promise<{
    numAffectedRows: bigint;
    rows: R[];
  }> {
    this.#stmtHandle = this.#odbcLib.allocHandle(
      HandleType.SQL_HANDLE_STMT,
      this.#dbcHandle,
    );

    try {
      this.#bindParams();

      const { colCount, numAffectedRows } = await this.#odbcLib.execDirect(
        this.#compiledQuery.sql,
        this.#stmtHandle,
      );

      if (colCount > 0) {
        this.#bindCols(colCount);

        for await (const row of this.#fetchRow()) {
          this.#rows.push(row);
        }
      }

      return {
        rows: this.#rows,
        numAffectedRows,
      };
    } finally {
      this.#cleanup();
    }
  }

  async *stream(chunkSize: number): AsyncIterableIterator<QueryResult<R>> {
    this.#stmtHandle = this.#odbcLib.allocHandle(
      HandleType.SQL_HANDLE_STMT,
      this.#dbcHandle,
    );

    try {
      this.#bindParams();

      const { colCount } = await this.#odbcLib.execDirect(
        this.#compiledQuery.sql,
        this.#stmtHandle,
      );

      if (colCount === 0) {
        yield { rows: [] };
        return;
      }

      this.#bindCols(colCount);

      let buffer: R[] = [];

      for await (const row of this.#fetchRow()) {
        buffer.push(row);

        if (buffer.length >= chunkSize) {
          yield { rows: buffer };
          buffer = [];
        }
      }

      if (buffer.length > 0) {
        yield { rows: buffer };
      }
    } finally {
      this.#cleanup();
    }
  }

  #cleanup(): void {
    this.#odbcLib.freeHandle(HandleType.SQL_HANDLE_STMT, this.#stmtHandle);
    this.#stmtHandle = null;
    this.#paramBindings.clear();
    this.#colBindings.clear();
  }

  #bindParams(): void {
    let i = 1;
    for (const val of this.#compiledQuery.parameters) {
      const odbcParam = this.#getParamBinding(val);

      this.#odbcLib.bindParameter(
        this.#stmtHandle,
        i,
        odbcParam.cType,
        odbcParam.sqlType,
        odbcParam.colSize,
        odbcParam.decimalDigits,
        odbcParam.buf,
        odbcParam.bufLen,
        odbcParam.lenIndBuf,
      );

      this.#paramBindings.set(i, odbcParam);
      i++;
    }
  }

  #bindCols(colCount: number): void {
    /**
     * We use the following column binding strategy:
     * 1. Bind columns as long as they fit in our buffer.
     * 2. If we encounter a Large Object or MAX type, we stop binding.
     * 3. That column and ALL subsequent columns must be retrieved manually via
     * SQLGetData to respect the ODBC forward-only cursor rule.
     */
    let manualGetDataMode = false;

    for (let i = 1; i <= colCount; i++) {
      const { colName, colSize, sqlType } = this.#odbcLib.describeCol(
        this.#stmtHandle,
        i,
      );

      const isSmallColumn = colSize !== 0n &&
        colSize <= MAX_BIND_SIZE &&
        sqlType !== SQLType.SQL_LONGVARCHAR &&
        sqlType !== SQLType.SQL_WLONGVARCHAR &&
        sqlType !== SQLType.SQL_LONGVARBINARY;

      if (!isSmallColumn) manualGetDataMode = true;

      let allocSize = colSize;
      if (allocSize === 0n || allocSize > MAX_BIND_SIZE) {
        allocSize = MAX_BIND_SIZE;
      }

      const isBound = !manualGetDataMode;

      const binding = this.#getColBinding(
        i,
        isBound,
        sqlType,
        allocSize,
      );

      if (isBound) {
        this.#odbcLib.bindCol(
          this.#stmtHandle,
          i,
          binding.cType,
          binding.buf,
          binding.bufLen,
          binding.lenIndBuf,
        );
      }

      this.#colBindings.set(colName, binding);
    }
  }

  #getParamBinding(val: unknown): ParamBinding {
    if (val === null || typeof val === "undefined" || val === undefined) {
      return {
        cType: CType.SQL_C_CHAR, // dummy
        sqlType: SQLType.SQL_CHAR, // dummy
        buf: new Uint8Array(),
        colSize: 0n,
        decimalDigits: 0,
        bufLen: 0n,
        lenIndBuf: new BigInt64Array([BigInt(SQL_NULL_DATA)]),
      };
    }

    if (
      typeof val === "bigint" ||
      (typeof val === "number" && val % 1 === 0)
    ) {
      // 32-bit integer
      if (val >= -2147483648 && val <= 2147483647) {
        const bufLen = 4n;
        return {
          cType: CType.SQL_C_SLONG,
          sqlType: SQLType.SQL_INTEGER,
          buf: new Int32Array([Number(val)]),
          colSize: 0n,
          decimalDigits: 0, // ignored by SQLBindParameter for this data type
          bufLen,
          lenIndBuf: new BigInt64Array([bufLen]),
        };
      } else {
        // 64-bit integer (BigInt)
        const bufLen = 8n;
        return {
          cType: CType.SQL_C_SBIGINT,
          sqlType: SQLType.SQL_BIGINT,
          buf: new BigInt64Array([BigInt(val)]),
          colSize: 0n,
          decimalDigits: 0, // ignored by SQLBindParameter for this data type
          bufLen,
          lenIndBuf: new BigInt64Array([bufLen]),
        };
      }
    }

    if (typeof val === "number") {
      const bufLen = 8n;
      return {
        cType: CType.SQL_C_DOUBLE,
        sqlType: SQLType.SQL_FLOAT,
        buf: new Float64Array([val]),
        colSize: 0n,
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
        bufLen,
        lenIndBuf: new BigInt64Array([bufLen]),
      };
    }

    if (typeof val === "boolean") {
      const bufLen = 1n;
      return {
        cType: CType.SQL_C_BIT,
        sqlType: SQLType.SQL_BIT,
        buf: new Uint8Array([val ? 1 : 0]),
        colSize: 0n,
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
        bufLen,
        lenIndBuf: new BigInt64Array([bufLen]),
      };
    }

    if (typeof val === "string") {
      const charLength = val.length;
      const buf = strToBuf(val);
      const isLong = charLength > 4000;
      return {
        cType: CType.SQL_C_WCHAR,
        sqlType: SQLType.SQL_WVARCHAR,
        buf,
        colSize: isLong ? 0n : 4000n, // size 0 implies MAX
        decimalDigits: 0,
        bufLen: BigInt(buf.length),
        lenIndBuf: new BigInt64Array([BigInt(SQL_NTS)]),
      };
    }

    if (ArrayBuffer.isView(val)) {
      const buf = new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
      const bufLen = BigInt(buf.byteLength);
      const isLong = bufLen > 8000n;
      return {
        cType: CType.SQL_C_BINARY,
        sqlType: SQLType.SQL_VARBINARY,
        buf: bufLen === 0n
          ? new Uint8Array(1) // prevents passing a NULL pointer for empty buffers
          : buf as unknown as Uint8Array<ArrayBuffer>,
        colSize: isLong ? 0n : 8000n,
        decimalDigits: 0,
        bufLen,
        lenIndBuf: new BigInt64Array([bufLen]),
      };
    }

    if (val instanceof Date) {
      if (isNaN(val.getTime())) {
        throw new Error("Cannot bind Invalid Date object");
      }
      const bufLen = 16;
      const buf = new Uint8Array(bufLen);
      const view = new DataView(buf.buffer);

      view.setInt16(0, val.getUTCFullYear(), true);
      view.setUint16(2, val.getUTCMonth() + 1, true);
      view.setUint16(4, val.getUTCDate(), true);
      view.setUint16(6, val.getUTCHours(), true);
      view.setUint16(8, val.getUTCMinutes(), true);
      view.setUint16(10, val.getUTCSeconds(), true);
      view.setUint32(12, val.getUTCMilliseconds() * 1_000_000, true);

      return {
        cType: CType.SQL_C_TYPE_TIMESTAMP,
        sqlType: SQLType.SQL_TYPE_TIMESTAMP,
        buf,
        colSize: 27n,
        decimalDigits: 7,
        bufLen: BigInt(bufLen),
        lenIndBuf: new BigInt64Array([BigInt(bufLen)]),
      };
    }

    throw new Error(`Unsupported data type: ${val} (Type ${typeof val})`);
  }

  #getColBinding(
    colNumber: number,
    isBound: boolean,
    sqlType: SQLType,
    colSize: bigint,
  ): ColBinding {
    const createInd = () => new BigInt64Array(1);

    if (sqlType === SQLType.SQL_INTEGER) {
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_SLONG,
        buf: new Int32Array(1),
        bufLen: 4n,
        lenIndBuf: createInd(),
      };
    }

    if (sqlType === SQLType.SQL_BIGINT) {
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_SBIGINT,
        buf: new BigInt64Array(1),
        bufLen: 8n,
        lenIndBuf: createInd(),
      };
    }

    if (sqlType === SQLType.SQL_TINYINT) {
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_UTINYINT,
        buf: new Uint8Array(1),
        bufLen: 1n,
        lenIndBuf: createInd(),
      };
    }

    if (sqlType === SQLType.SQL_SMALLINT) {
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_SSHORT,
        buf: new Int16Array(1),
        bufLen: 2n,
        lenIndBuf: createInd(),
      };
    }

    // Safest way is to bind SQL_NUMERIC and SQL_DECIMAL as strings since JS could loose precision when treating these as numbers
    if (
      sqlType === SQLType.SQL_NUMERIC ||
      sqlType === SQLType.SQL_DECIMAL
    ) {
      const len = Number(colSize) + 4;
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_WCHAR,
        buf: new Uint16Array(len),
        bufLen: BigInt(len * 2),
        lenIndBuf: createInd(),
      };
    }

    if (sqlType === SQLType.SQL_FLOAT) {
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_DOUBLE,
        buf: new Float64Array(1),
        bufLen: 8n,
        lenIndBuf: createInd(),
      };
    }

    if (sqlType === SQLType.SQL_BIT) {
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_BIT,
        buf: new Uint8Array(1),
        bufLen: 1n,
        lenIndBuf: createInd(),
      };
    }

    if (
      sqlType === SQLType.SQL_BINARY ||
      sqlType === SQLType.SQL_VARBINARY ||
      sqlType === SQLType.SQL_LONGVARBINARY
    ) {
      const len = Number(colSize);
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_BINARY,
        buf: new Uint8Array(len),
        bufLen: colSize,
        lenIndBuf: createInd(),
      };
    }

    if (
      sqlType === SQLType.SQL_CHAR ||
      sqlType === SQLType.SQL_VARCHAR ||
      sqlType === SQLType.SQL_LONGVARCHAR ||
      sqlType === SQLType.SQL_WCHAR ||
      sqlType === SQLType.SQL_WVARCHAR ||
      sqlType === SQLType.SQL_WLONGVARCHAR
    ) {
      const len = Number(colSize) + 1; // +1 for null terminator
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_WCHAR,
        buf: new Uint16Array(len),
        bufLen: BigInt(len * 2),
        lenIndBuf: createInd(),
      };
    }

    if (
      sqlType === SQLType.SQL_TYPE_TIMESTAMP ||
      sqlType === SQLType.SQL_TYPE_DATE
    ) {
      const len = 16;
      return {
        colNumber,
        isBound,
        cType: CType.SQL_C_TYPE_TIMESTAMP,
        buf: new Uint8Array(len),
        bufLen: BigInt(len),
        lenIndBuf: createInd(),
      };
    }

    throw new Error(`Unsupported SQL dataType: ${sqlType}`);
  }

  async #fetchRemainingData(
    colBinding: ColBinding,
    initialChunk: Uint8Array | string,
  ): Promise<Uint8Array | string> {
    const { colNumber, cType, buf, bufLen, lenIndBuf } = colBinding;

    const chunks: (Uint8Array | string)[] = [initialChunk];

    while (true) {
      const status = await this.#odbcLib.getData(
        this.#stmtHandle,
        colNumber,
        cType,
        buf,
        bufLen,
        lenIndBuf,
      );

      if (status === SQLRETURN.SQL_NO_DATA) break;

      const byteLen = Number(lenIndBuf[0]);
      if (byteLen === SQL_NULL_DATA) break;

      const isTruncated = status !== SQLRETURN.SQL_SUCCESS;

      if (cType === CType.SQL_C_WCHAR) {
        let validChars = 0;

        if (isTruncated) {
          validChars = Number(bufLen) / 2;
          if (buf[validChars - 1] === 0) validChars--;
        } else {
          validChars = byteLen / 2;
        }

        if (validChars > buf.length) validChars = buf.length;

        chunks.push(bufToStr(buf as Uint16Array, validChars));
      } else {
        const validBytes = isTruncated ? Number(bufLen) : byteLen;
        chunks.push((buf as Uint8Array).slice(0, validBytes));
      }

      if (!isTruncated) break;
    }

    if (cType === CType.SQL_C_WCHAR) {
      return chunks.join("");
    } else {
      const totalLen = chunks.reduce((acc, p) => acc + p.length, 0);
      const res = new Uint8Array(totalLen);
      let offset = 0;
      for (const p of chunks) {
        const u8 = p as Uint8Array;
        res.set(u8, offset);
        offset += u8.length;
      }
      return res;
    }
  }

  async #readRow(): Promise<Record<string, unknown>> {
    const row: Record<string, unknown> = {};

    for (const [colName, colBinding] of this.#colBindings) {
      const { buf, lenIndBuf, cType, bufLen, isBound, colNumber } = colBinding;

      /**
       * This can either be the length of the data after conversion and before truncation,
       * or SQL_NO_TOTAL if the driver cannot determine the length of the data after conversion,
       * or SQL_NULL_DATA if the data is NULL.
       */
      let byteLen: number;
      let isTruncated = false;

      if (isBound) {
        byteLen = Number(lenIndBuf[0]);

        if (byteLen === SQL_NULL_DATA) {
          row[colName] = null;
          continue;
        }

        isTruncated = byteLen > Number(bufLen) || byteLen === SQL_NO_TOTAL;
      } else {
        const status = await this.#odbcLib.getData(
          this.#stmtHandle,
          colNumber,
          cType,
          buf,
          bufLen,
          lenIndBuf,
        );

        byteLen = Number(lenIndBuf[0]);

        if (status === SQLRETURN.SQL_NO_DATA || byteLen === SQL_NULL_DATA) {
          row[colName] = null;
          continue;
        }

        // For Unbound columns, the Status Code explicitly tells us if truncated
        isTruncated = status !== SQLRETURN.SQL_SUCCESS;
      }

      let value: number | string | bigint | boolean | Uint8Array | Date;

      switch (cType) {
        /**
         * Fixed-length data types:
         */
        case CType.SQL_C_SLONG:
        case CType.SQL_C_SBIGINT:
        case CType.SQL_C_DOUBLE:
        case CType.SQL_C_UTINYINT:
        case CType.SQL_C_SSHORT:
          value = buf[0];
          break;

        case CType.SQL_C_BIT:
          value = buf[0] === 1;
          break;

        case CType.SQL_C_TYPE_TIMESTAMP: {
          const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

          const year = view.getInt16(0, true); // SQLSMALLINT
          const month = view.getUint16(2, true); // SQLUSMALLINT
          const day = view.getUint16(4, true); // SQLUSMALLINT
          const hour = view.getUint16(6, true); // SQLUSMALLINT
          const minute = view.getUint16(8, true); // SQLUSMALLINT
          const second = view.getUint16(10, true); // SQLUSMALLINT
          const fraction = view.getUint32(12, true); // SQLUINTEGER

          const ms = Math.round(fraction / 1_000_000);

          value = new Date(
            Date.UTC(year, month - 1, day, hour, minute, second, ms), // month is zero indexed
          );
          break;
        }

        /**
         * Variable-length data types:
         */
        case CType.SQL_C_BINARY: {
          const validBytes = isTruncated ? Number(bufLen) : byteLen;
          const initialChunk = (buf as Uint8Array).slice(0, validBytes);

          value = isTruncated
            ? await this.#fetchRemainingData(colBinding, initialChunk)
            : initialChunk;

          break;
        }

        case CType.SQL_C_WCHAR: {
          let validChars = 0;

          if (isTruncated) {
            validChars = Number(bufLen) / 2;
            if (buf[validChars - 1] === 0) validChars--;
          } else {
            validChars = byteLen / 2;
          }

          const initialStr = bufToStr(buf as Uint16Array, validChars);

          value = isTruncated
            ? await this.#fetchRemainingData(colBinding, initialStr)
            : initialStr;

          break;
        }

        default:
          throw new Error(`Unknown binding C-Type: ${cType}`);
      }

      row[colName] = value;
    }

    return row;
  }

  async *#fetchRow(): AsyncGenerator<R> {
    while (await this.#odbcLib.fetch(this.#stmtHandle)) {
      const row = await this.#readRow();
      yield row as R;
    }
  }
}
