import { CompiledQuery, QueryResult } from "@kysely/kysely";
import { odbcLib, allocHandle, sqlExecDirect, SQL_HANDLE_STMT } from "./ffi.ts";

export class OdbcRequest<O> {
  #query: CompiledQuery;
  #dbcHandle: Deno.PointerValue;
  #stmtHandle: Deno.PointerValue = null;

  constructor(query: CompiledQuery, dbcHandle: Deno.PointerValue) {
    this.#query = query;
    this.#dbcHandle = dbcHandle;
  }

  async execute(): Promise<QueryResult<O>> {
    await this.#allocateStmt();

    try {
      await this.#execDirect();

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
      await this.#freeStmt();
    }
  }

  async *stream(chunkSize: number): AsyncIterableIterator<QueryResult<O>> {
    await this.#allocateStmt();
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

  async #allocateStmt() {
    this.#stmtHandle = await allocHandle(SQL_HANDLE_STMT, this.#dbcHandle);
  }

  async #freeStmt() {
    if (this.#stmtHandle === null) return;

    await odbcLib.symbols.SQLFreeHandle(SQL_HANDLE_STMT, this.#stmtHandle);
    this.#stmtHandle = null;
  }

  async #execDirect() {
    await sqlExecDirect(this.#query.sql, this.#stmtHandle);
  }

  #formatValue(value: unknown): string {}

  #fetchOne(): O | null {}

  #getRowCount(): bigint {}

  #getNumResultCols(): number {}

  #describeColumns(colCount: number): string[] {}

  #fetch(): boolean {}

  #readRow(colNames: string[]): O {}
}
