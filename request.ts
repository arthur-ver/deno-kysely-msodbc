import { CompiledQuery, QueryResult } from "@kysely/kysely";
import { odbcLib, allocHandle, execDirect, SQL_HANDLE_STMT } from "./ffi.ts";

export class OdbcRequest<O> {
  readonly #compiledQuery: CompiledQuery;
  readonly #dbcHandle: Deno.PointerValue;
  readonly #rows: O[];
  readonly #streamChunkSize: number | undefined;
  readonly #subscribers: Record<
    string,
    (event: "completed" | "chunkReady" | "error", error?: unknown) => void
  >;
  #rowCount: number | undefined;

  #stmtHandle: Deno.PointerValue = null;

  constructor(
    compiledQuery: CompiledQuery,
    dbcHandle: Deno.PointerValue,
    streamChunkSize?: number
  ) {
    this.#compiledQuery = compiledQuery;
    this.#dbcHandle = dbcHandle;
    this.#rows = [];
    this.#streamChunkSize = streamChunkSize;
    this.#subscribers = {};
  }

  async execute(): Promise<{
    rowCount: number | undefined;
    rows: O[];
  }> {
    this.#stmtHandle = await allocHandle(SQL_HANDLE_STMT, this.#dbcHandle);

    try {
      await execDirect(this.#compiledQuery.sql, this.#stmtHandle);

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

  async #allocateStmt() {}

  async #freeStmt() {
    if (this.#stmtHandle === null) return;

    await odbcLib.symbols.SQLFreeHandle(SQL_HANDLE_STMT, this.#stmtHandle);
    this.#stmtHandle = null;
  }

  #formatValue(value: unknown) {}

  #fetchOne() {}

  #getRowCount() {}

  #getNumResultCols() {}

  #describeColumns(colCount: number) {}

  #fetch() {}

  #readRow(colNames: string[]) {}
}
