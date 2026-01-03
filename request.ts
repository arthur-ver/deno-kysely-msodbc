import { CompiledQuery, QueryResult } from "@kysely/kysely";
import {
  allocHandle,
  bindParameter,
  describeCol,
  execDirect,
  HandleType,
  numResultCols,
  odbcLib,
  ParameterType,
  SQL_NULL_DATA,
  strToBuf,
  ValueType,
} from "./ffi.ts";

export class OdbcRequest<O> {
  readonly #compiledQuery: CompiledQuery;
  readonly #dbcHandle: Deno.PointerValue;

  #stmtHandle: Deno.PointerValue = null;
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

      //const bindings: ColumnBind[] = [];
      for (let i = 1; i <= colCount; i++) {
        const desc = await describeCol(this.#stmtHandle, i);
        console.log(desc);

        // Determine buffer size (e.g., +1 for null terminator if string)
        // Note: For VARCHAR(MAX), you might still need chunks, but for
        // standard fields, allocate the full size.
        //const bufSize = Math.max(desc.size, 256);

        // Create the buffer (Native memory ownership stays with JS, but ODBC writes to it)
        //const buffer = new Uint8Array(bufSize);
        //const lenInd = new BigInt64Array(1); // SQLLEN pointer

        // BIND IT: Tell ODBC "Put column #i data here"
        /*const ret = lib.symbols.SQLBindCol(
          this.#stmtHandle,
          i,
          SQL_C_CHAR, // Request everything as string for simplicity (or map types)
          buffer,
          bufSize,
          lenInd,
        );

        if (ret !== SQL_SUCCESS) throw new Error("Bind failed");

        bindings.push({ name: desc.name, type: desc.type, buffer, lenInd });*/
      }

      return {} as any;
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
      if (
        val === null || typeof val === "undefined" || val === undefined
      ) {
        const nullBuf = new Uint8Array();
        const lenIndBuf = new BigInt64Array([BigInt(SQL_NULL_DATA)]);

        await bindParameter(
          this.#stmtHandle,
          i,
          ValueType.DUMMY,
          ParameterType.DUMMY,
          0n,
          0,
          nullBuf,
          0n,
          lenIndBuf,
        );

        this.#preventGC.push(nullBuf);
        this.#preventGC.push(lenIndBuf);

        i++;
        continue;
      }

      const param = this.#getOdbcParameter(val);

      const bufLen = BigInt(param.buf.byteLength);
      const lenIndBuf = new BigInt64Array([bufLen]);

      await bindParameter(
        this.#stmtHandle,
        i,
        param.cType,
        param.sqlType,
        param.columnSize,
        param.decimalDigits,
        param.buf,
        bufLen,
        lenIndBuf,
      );

      this.#preventGC.push(param.buf);
      this.#preventGC.push(lenIndBuf);

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
  } {
    if (
      typeof val === "bigint" ||
      (typeof val === "number" && val % 1 === 0)
    ) {
      // 32-bit integer
      if (val >= -2147483648 && val <= 2147483647) {
        return {
          cType: ValueType.SQL_C_SLONG,
          sqlType: ParameterType.SQL_INTEGER,
          buf: new Int32Array([Number(val)]),
          columnSize: 0n, // ignored by SQLBindParameter for this data type
          decimalDigits: 0, // ignored by SQLBindParameter for this data type
        };
      } else {
        // 64-bit integer (BigInt)
        return {
          cType: ValueType.SQL_C_SBIGINT,
          sqlType: ParameterType.SQL_BIGINT,
          buf: new BigInt64Array([BigInt(val)]),
          columnSize: 0n, // ignored by SQLBindParameter for this data type
          decimalDigits: 0, // ignored by SQLBindParameter for this data type
        };
      }
    }

    if (typeof val === "number") {
      return {
        cType: ValueType.SQL_C_DOUBLE,
        sqlType: ParameterType.SQL_FLOAT,
        buf: new Float64Array([val]),
        columnSize: 0n, // ignored by SQLBindParameter for this data type
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
      };
    }

    if (typeof val === "boolean") {
      return {
        cType: ValueType.SQL_C_BIT,
        sqlType: ParameterType.SQL_BIT,
        buf: new Uint8Array([val ? 1 : 0]),
        columnSize: 0n, // ignored by SQLBindParameter for this data type
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
      };
    }

    if (typeof val === "string") {
      return {
        cType: ValueType.SQL_C_WCHAR,
        sqlType: ParameterType.SQL_WVARCHAR,
        buf: strToBuf(val),
        columnSize: BigInt(val.length), // charLength
        decimalDigits: 0, // ignored by SQLBindParameter for this data type
      };
    }

    throw new Error(`Unsupported data type: ${val} (Type ${typeof val})`);

    // TODO: implement Dates + Buffers
  }
}
