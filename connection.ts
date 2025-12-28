import {
  CompiledQuery,
  DatabaseConnection,
  QueryResult,
  TransactionSettings,
} from "@kysely/kysely";
import {
  odbcLib,
  allocHandle,
  sqlDriverConnect,
  SQL_HANDLE_DBC,
} from "./ffi.ts";
import { OdbcRequest } from "./request.ts";

export class OdbcConnection implements DatabaseConnection {
  readonly #connectionString: string;
  #envHandle: Deno.PointerValue;
  #dbcHandle: Deno.PointerValue = null;

  constructor(connectionString: string, envHandle: Deno.PointerValue) {
    this.#connectionString = connectionString;
    this.#envHandle = envHandle;
  }

  async connect(): Promise<void> {
    this.#dbcHandle = await allocHandle(SQL_HANDLE_DBC, this.#envHandle);

    try {
      await sqlDriverConnect(this.#connectionString, this.#dbcHandle);
    } catch (error) {
      await this.destroy();
      throw error;
    }
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }
    const request = new OdbcRequest<O>(compiledQuery, this.#dbcHandle);
    return request.execute();
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }
    const request = new OdbcRequest<O>(compiledQuery, this.#dbcHandle);
    yield* request.stream(chunkSize);
  }

  async beginTransaction(settings: TransactionSettings): Promise<void> {}

  async commitTransaction(): Promise<void> {}

  async rollbackTransaction(): Promise<void> {}

  async destroy(): Promise<void> {
    if (this.#dbcHandle === null) return;

    try {
      // just in case we weren't actually connected
      await odbcLib.symbols.SQLDisconnect(this.#dbcHandle);
    } catch {
      /* ignore */
    }
    await odbcLib.symbols.SQLFreeHandle(SQL_HANDLE_DBC, this.#dbcHandle);
    this.#dbcHandle = null;
  }

  validate(): boolean {
    return this.#dbcHandle !== null;
  }
}
