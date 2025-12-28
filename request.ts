import { CompiledQuery, QueryResult } from "@kysely/kysely";
import { odbcLib, allocHandle, sqlExecDirect, SQL_HANDLE_STMT } from "./ffi.ts";

export class OdbcRequest<O> {
  #query: CompiledQuery;
  #dbcHandle: Deno.PointerValue;
  #stmtHandle: Deno.PointerValue = null;

  constructor(query: CompiledQuery, dbcHandle: Deno.PointerValue) {
    this.#query = query;
    this.#dbcHandle = dbcHandle;

    console.log("request constructed");
  }

  async execute(): Promise<QueryResult<O>> {
    this.#allocateStmt();

    try {
      this.#execDirect();

      const numAffectedRows = this.#getRowCount();
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
      };
    } finally {
      this.#freeStmt();
    }
  }

  async *stream(chunkSize: number): AsyncIterableIterator<QueryResult<O>> {
    this.#allocateStmt();
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
    }
  }

  #allocateStmt() {
    this.#stmtHandle = allocHandle(SQL_HANDLE_STMT, this.#dbcHandle);
  }

  #freeStmt() {
    if (this.#stmtHandle) {
      odbcLib.symbols.SQLFreeHandle(SQL_HANDLE_STMT, this.#stmtHandle);
      this.#stmtHandle = null;
    }
  }

  #execDirect() {
    console.log(this.#query.sql);
    sqlExecDirect(this.#query.sql, this.#stmtHandle);
  }

  #formatValue(value: unknown): string {}

  #fetchOne(): O | null {}

  #getRowCount(): bigint {}

  #getNumResultCols(): number {}

  #describeColumns(colCount: number): string[] {}

  #fetch(): boolean {}

  #readRow(colNames: string[]): O {}
}
