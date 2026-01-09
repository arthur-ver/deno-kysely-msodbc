import {
  CompiledQuery,
  DatabaseConnection,
  QueryResult,
  TransactionSettings,
} from "@kysely/kysely";
import { HandleType, type OdbcLib } from "./odbc.ts";
import { OdbcRequest } from "./request.ts";

export class OdbcConnection implements DatabaseConnection {
  readonly #odbcLib: OdbcLib;
  readonly #connectionString: string;
  #envHandle: Deno.PointerValue;
  #dbcHandle: Deno.PointerValue = null;
  #hasSocketError: boolean = false;

  constructor(
    odbcLib: OdbcLib,
    connectionString: string,
    envHandle: Deno.PointerValue,
  ) {
    this.#odbcLib = odbcLib;
    this.#connectionString = connectionString;
    this.#envHandle = envHandle;
  }

  async connect(): Promise<this> {
    this.#dbcHandle = this.#odbcLib.allocHandle(
      HandleType.SQL_HANDLE_DBC,
      this.#envHandle,
    );
    try {
      await this.#odbcLib.driverConnect(
        this.#connectionString,
        this.#dbcHandle,
      );
    } catch (error) {
      this.#hasSocketError = true;
      throw error;
    }
    return this;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }

    const request = new OdbcRequest<R>(
      this.#odbcLib,
      compiledQuery,
      this.#dbcHandle,
    );
    const { numAffectedRows, rows } = await request.execute();

    return {
      numAffectedRows: numAffectedRows !== -1n ? numAffectedRows : undefined,
      rows,
    };
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }

    const request = new OdbcRequest<R>(
      this.#odbcLib,
      compiledQuery,
      this.#dbcHandle,
    );
    yield* request.stream(chunkSize);
  }

  async beginTransaction(settings: TransactionSettings): Promise<void> {}

  async commitTransaction(): Promise<void> {}

  async rollbackTransaction(): Promise<void> {}

  async destroy(): Promise<void> {
    if (this.#dbcHandle === null) return;

    try {
      // just in case we weren't actually connected
      await this.#odbcLib.disconnect(this.#dbcHandle);
    } catch {
      /* ignore */
    }
    this.#odbcLib.freeHandle(HandleType.SQL_HANDLE_DBC, this.#dbcHandle);
    this.#dbcHandle = null;
  }

  async validate(): Promise<boolean> {
    if (
      this.#hasSocketError ||
      this.#dbcHandle === null
    ) {
      return false;
    }

    const compiledQuery = CompiledQuery.raw("select 1");
    const request = new OdbcRequest<unknown>(
      this.#odbcLib,
      compiledQuery,
      this.#dbcHandle,
    );
    await request.execute();

    return true;
  }

  async reset(): Promise<void> {
    if (this.#dbcHandle === null) return;
    await this.#odbcLib.rollbackTransaction(this.#dbcHandle);
  }
}
