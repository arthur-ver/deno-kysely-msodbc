import { CompiledQuery, QueryResult } from "@kysely/kysely";
import {
  allocHandle,
  bindCol,
  bindParameter,
  bufToStr,
  describeCol,
  execDirect,
  fetch,
  getOdbcError,
  HandleType,
  numResultCols,
  odbcLib,
  ParameterType,
  SQL_NTS,
  SQL_NULL_DATA,
  SQLRETURN,
  strToBuf,
  ValueType,
} from "./ffi.ts";

const MAX_BIND_SIZE = 65536; // 64kb

type ColBinding = {
  cType: ValueType;
  buf:
    | Uint8Array<ArrayBuffer>
    | Int32Array<ArrayBuffer>
    | BigInt64Array<ArrayBuffer>
    | Float64Array<ArrayBuffer>
    | Uint16Array<ArrayBuffer>;
  bufLen: bigint;
  lenIndBuf: BigInt64Array<ArrayBuffer>;
};

export class OdbcRequest<O> {
  readonly #compiledQuery: CompiledQuery;
  readonly #dbcHandle: Deno.PointerValue;

  #stmtHandle: Deno.PointerValue = null;
  #rows: O[] = [];
  #preventGC: unknown[] = []; // keep buffers from being garbage collected

  constructor(
    compiledQuery: CompiledQuery,
    dbcHandle: Deno.PointerValue,
  ) {
    this.#compiledQuery = compiledQuery;
    this.#dbcHandle = dbcHandle;
  }

  async execute(): Promise<{
    rowCount: number | undefined;
    rows: O[];
  }> {
    this.#stmtHandle = await allocHandle(
      HandleType.SQL_HANDLE_STMT,
      this.#dbcHandle,
    );

    try {
      await this.#bindParams(this.#compiledQuery.parameters);
      await execDirect(this.#compiledQuery.sql, this.#stmtHandle);
      const colCount = await numResultCols(this.#stmtHandle);

      const bindings: ColBinding[] = [];
      for (let i = 1; i <= colCount; i++) {
        const desc = await describeCol(this.#stmtHandle, i);

        if (desc.columnSize === 0n || desc.columnSize > MAX_BIND_SIZE) {
          throw new Error(`Unable to bind column ${desc}!`);
        }

        const binding = this.#getOutputBuffer(desc.dataType, desc.columnSize);

        await bindCol(
          this.#stmtHandle,
          i,
          binding.cType,
          binding.buf,
          binding.bufLen,
          binding.lenIndBuf,
        );

        bindings.push(binding);
      }

      while (true) {
        const status = await fetch(this.#stmtHandle);

        if (status === SQLRETURN.SQL_SUCCESS) {
          this.#rows.push(this.#readRow(bindings) as any);
          continue;
        }

        if (status === SQLRETURN.SQL_SUCCESS_WITH_INFO) {
          // Optional: read the diagnostic record here
          continue;
        }

        if (status === SQLRETURN.SQL_NO_DATA) {
          break;
        }

        if (status === SQLRETURN.SQL_ERROR) {
          throw new Error(`SQLFetch failed: ${await getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            this.#stmtHandle,
          )}`);
        }

        throw new Error(`SQLFetch returned unexpected status: ${status}`);
      }

      return {
        rows: this.#rows as any,
        rowCount: this.#rows.length,
      };
    } finally {
      await this.#cleanup();
    }
  }

  async *stream(chunkSize: number): AsyncIterableIterator<QueryResult<O>> {
    /*await this.#allocateStmt();
    try {
      this.#execDirect();

      let chunk: O[] = [];
      while (true) {
        const row = this.#fetchOne();
        if (!row) break;

        chunk.push(row);

        if (chunk.length >= chunkSize) {
          yield { rows: chunk };
          chunk = [];
        }
      }
      if (chunk.length > 0) yield { rows: chunk };
    } finally {
      this.#freeStmt();
    }*/
  }

  async #cleanup(): Promise<void> {
    await this.#freeStmt();
    this.#preventGC = [];
  }

  async #freeStmt(): Promise<void> {
    await odbcLib.SQLFreeHandle(HandleType.SQL_HANDLE_STMT, this.#stmtHandle);
    this.#stmtHandle = null;
  }

  async #bindParams(params: CompiledQuery["parameters"]): Promise<void> {
    let i = 1;
    for (const val of params) {
      const param = this.#getOdbcParameter(val);

      await bindParameter(
        this.#stmtHandle,
        i,
        param.cType,
        param.sqlType,
        param.columnSize,
        param.decimalDigits,
        param.buf,
        param.bufLen,
        param.lenIndBuf,
      );

      this.#preventGC.push(param.buf);
      this.#preventGC.push(param.lenIndBuf);

      i++;
    }
  }

  /**
   * Determines the appropriate ODBC C-Type, SQL-Type, and binary buffer representation for a given JavaScript value.
   *
   * This function automatically maps JavaScript types to their most appropriate ODBC equivalents:
   * - **Integers (32-bit)**: Maps to `SQL_INTEGER` (`SQL_C_SLONG`).
   * - **Integers (64-bit)**: Maps to `SQL_BIGINT` (`SQL_C_SBIGINT`).
   * - **Floats**: Maps to `SQL_FLOAT` (`SQL_C_DOUBLE`).
   * - **Booleans**: Maps to `SQL_BIT` (`SQL_C_BIT`).
   * - **Strings**: Maps to `SQL_WVARCHAR` (`SQL_C_WCHAR`) using UTF-16 encoding.
   *
   * It calculates the correct `columnSize` and `decimalDigits` required by `SQLBindParameter`.
   * For fixed-width types (Integer, Float, Bit), these values are set to `0` as they are
   * ignored by the driver. For variable-width types (String), `columnSize` is set to the
   * character length.
   *
   * @param value The JavaScript value to bind to the SQL parameter.
   * @returns An object containing the ODBC type definitions and the binary data buffer.
   * @throws If the value type is not supported (e.g., Object, Symbol, Function).
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/appendixes/column-size?view=sql-server-ver17}
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/appendixes/decimal-digits?view=sql-server-ver17}
   */
  #getOdbcParameter(val: unknown): {
    cType: ValueType;
    sqlType: ParameterType;
    buf:
      | Int32Array<ArrayBuffer>
      | BigInt64Array<ArrayBuffer>
      | Uint8Array<ArrayBuffer>
      | Float64Array<ArrayBuffer>;
    columnSize: bigint;
    decimalDigits: number;
    bufLen: bigint;
    lenIndBuf: BigInt64Array<ArrayBuffer>;
  } {
    // NULL
    if (val === null || typeof val === "undefined" || val === undefined) {
      return {
        cType: 1, // dummy
        sqlType: 1, // dummy
        buf: new Uint8Array(),
        columnSize: 0n,
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
          cType: ValueType.SQL_C_SLONG,
          sqlType: ParameterType.SQL_INTEGER,
          buf: new Int32Array([Number(val)]),
          columnSize: 0n, // ignored by SQLBindParameter for this data type
          decimalDigits: 0, // ignored by SQLBindParameter for this data type
          bufLen,
          lenIndBuf: new BigInt64Array([bufLen]),
        };
      } else {
        // 64-bit integer (BigInt)
        const bufLen = 8n;
        return {
          cType: ValueType.SQL_C_SBIGINT,
          sqlType: ParameterType.SQL_BIGINT,
          buf: new BigInt64Array([BigInt(val)]),
          columnSize: 0n, // ignored by SQLBindParameter for this data type
          decimalDigits: 0, // ignored by SQLBindParameter for this data type
          bufLen,
          lenIndBuf: new BigInt64Array([bufLen]),
        };
      }
    }

    if (typeof val === "number") {
      const bufLen = 8n;
      return {
        cType: ValueType.SQL_C_DOUBLE,
        sqlType: ParameterType.SQL_FLOAT,
        buf: new Float64Array([val]),
        columnSize: 0n, // ignored by SQLBindParameter for this data type
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
        bufLen,
        lenIndBuf: new BigInt64Array([bufLen]),
      };
    }

    if (typeof val === "boolean") {
      const bufLen = 1n;
      return {
        cType: ValueType.SQL_C_BIT,
        sqlType: ParameterType.SQL_BIT,
        buf: new Uint8Array([val ? 1 : 0]),
        columnSize: 0n, // ignored by SQLBindParameter for this data type
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
        bufLen,
        lenIndBuf: new BigInt64Array([bufLen]),
      };
    }

    if (typeof val === "string") {
      const charLength = val.length;
      const bufLen = (charLength + 1) * 2;
      return {
        cType: ValueType.SQL_C_WCHAR,
        sqlType: ParameterType.SQL_WVARCHAR,
        buf: strToBuf(val),
        columnSize: BigInt(charLength), // charLength
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
        bufLen: BigInt(bufLen),
        lenIndBuf: new BigInt64Array([BigInt(SQL_NTS)]),
      };
    }

    throw new Error(`Unsupported data type: ${val} (Type ${typeof val})`);

    // TODO: implement Dates + Buffers
  }

  #getOutputBuffer(dataType: number, columnSize: bigint): ColBinding {
    const createInd = () => new BigInt64Array(1);

    // 32-bit integer
    if (dataType === ParameterType.SQL_INTEGER) {
      return {
        cType: ValueType.SQL_C_SLONG,
        buf: new Int32Array(1),
        bufLen: 4n,
        lenIndBuf: createInd(),
      };
    }

    // 64-bit integer (BigInt)
    if (dataType === ParameterType.SQL_BIGINT) {
      return {
        cType: ValueType.SQL_C_SBIGINT,
        buf: new BigInt64Array(1),
        bufLen: 8n,
        lenIndBuf: createInd(),
      };
    }

    if (dataType === ParameterType.SQL_FLOAT) {
      return {
        cType: ValueType.SQL_C_DOUBLE,
        buf: new Float64Array(1),
        bufLen: 8n,
        lenIndBuf: createInd(),
      };
    }

    if (dataType === ParameterType.SQL_BIT) {
      return {
        cType: ValueType.SQL_C_BIT,
        buf: new Uint8Array(1),
        bufLen: 1n,
        lenIndBuf: createInd(),
      };
    }

    if (
      dataType === ParameterType.SQL_CHAR ||
      dataType === ParameterType.SQL_VARCHAR ||
      dataType === ParameterType.SQL_LONGVARCHAR ||
      dataType === ParameterType.SQL_WCHAR ||
      dataType === ParameterType.SQL_WVARCHAR ||
      dataType === ParameterType.SQL_WLONGVARCHAR
    ) {
      const len = Number(columnSize) + 1; // +1 for null terminator
      return {
        cType: ValueType.SQL_C_WCHAR,
        buf: new Uint16Array(len),
        bufLen: BigInt(len * 2),
        lenIndBuf: createInd(),
      };
    }

    if (
      dataType === ParameterType.SQL_TYPE_TIMESTAMP ||
      dataType === ParameterType.SQL_TYPE_DATE
    ) {
      const len = 30; // Sufficient for "YYYY-MM-DD HH:MM:SS.FFF..."
      return {
        cType: ValueType.SQL_C_WCHAR,
        buf: new Uint16Array(len),
        bufLen: BigInt(len * 2),
        lenIndBuf: createInd(),
      };
    }

    throw new Error(`Unsupported SQL dataType: ${dataType}`);
  }

  #readRow(bindings: ColBinding[]) {
    return bindings.map(({ buf, lenIndBuf, cType }) => {
      const byteLen = Number(lenIndBuf[0]);

      if (byteLen === SQL_NULL_DATA) {
        return null;
      }

      switch (cType) {
        case ValueType.SQL_C_SLONG:
        case ValueType.SQL_C_SBIGINT:
        case ValueType.SQL_C_DOUBLE:
          return buf[0];

        case ValueType.SQL_C_BIT:
          return buf[0] === 1;

        case ValueType.SQL_C_WCHAR:
          return bufToStr(buf as Uint16Array, byteLen / 2);

        default:
          throw new Error(`Unknown binding C-Type: ${cType}`);
      }
    });
  }
}
