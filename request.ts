import { CompiledQuery, QueryResult } from "@kysely/kysely";
import {
  allocHandle,
  execDirect,
  getOdbcParameter,
  HandleType,
  odbcLib,
  rowCount,
  SQL_NULL_DATA,
  SQL_PARAM_INPUT,
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

    let i = 1;
    for (const param of this.#compiledQuery.parameters) {
      await this.#bindParam(param, i);
      i++;
    }

    try {
      await execDirect(this.#compiledQuery.sql, this.#stmtHandle);
      const numAffectedRows = await rowCount(this.#stmtHandle);
      const rows: O[] = [];

      /*const numAffectedRows = this.#getRowCount();
      const colCount = this.#getNumResultCols();
      const rows: O[] = [];
      if (colCount > 0) {
        const colNames = this.#describeColumns(colCount);
        while (this.#fetch()) {
          rows.push(this.#readRow(colNames));
        }
      }

      return {
        rows,
        numAffectedRows: numAffectedRows > 0n ? numAffectedRows : undefined,
      };*/
      return {} as any;
    } finally {
      await this.#freeStmt();
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

  async #freeStmt() {
    await odbcLib.SQLFreeHandle(HandleType.SQL_HANDLE_STMT, this.#stmtHandle);
    this.#stmtHandle = null;
  }

  async #bindParam(value: unknown, i: number): Promise<void> {
    if (value === null || typeof value === "undefined" || value === undefined) {
      const nullBuf = new Uint8Array();
      const lenInd = new BigInt64Array([BigInt(SQL_NULL_DATA)]);

      await odbcLib.SQLBindParameter(
        this.#stmtHandle,
        i,
        SQL_PARAM_INPUT,
        1, // dummy
        1, // dummy
        0n,
        0,
        nullBuf,
        0n,
        lenInd,
      );

      this.#preventGC.push(nullBuf);
      this.#preventGC.push(lenInd);

      return;
    }

    const param = getOdbcParameter(value);

    const bufLen = BigInt(param.buf.byteLength);
    const lenInd = new BigInt64Array([bufLen]);

    const columnSize = 0n; // TODO
    const decimalDigits = 0; // TODO

    await odbcLib.SQLBindParameter(
      this.#stmtHandle,
      i,
      SQL_PARAM_INPUT,
      param.cType,
      param.sqlType,
      columnSize,
      decimalDigits,
      param.buf,
      bufLen,
      lenInd,
    );

    this.#preventGC.push(param.buf);
    this.#preventGC.push(lenInd);
  }
}
