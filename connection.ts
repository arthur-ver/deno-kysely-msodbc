import {
  CompiledQuery,
  DatabaseConnection,
  QueryResult,
  TransactionSettings,
} from "@kysely/kysely";
import { allocHandle, driverConnect, HandleType, odbcLib } from "./ffi.ts";
import { OdbcRequest } from "./request.ts";

export class OdbcConnection implements DatabaseConnection {
  readonly #connectionString: string;
  #envHandle: Deno.PointerValue;
  #dbcHandle: Deno.PointerValue = null;
  #hasSocketError: boolean = false;

  constructor(connectionString: string, envHandle: Deno.PointerValue) {
    this.#connectionString = connectionString;
    this.#envHandle = envHandle;
  }

  async connect(): Promise<this> {
    this.#dbcHandle = allocHandle(
      HandleType.SQL_HANDLE_DBC,
      this.#envHandle,
    );
    try {
      await driverConnect(this.#connectionString, this.#dbcHandle);
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

    const request = new OdbcRequest<R>(compiledQuery, this.#dbcHandle);
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

    const request = new OdbcRequest<R>(compiledQuery, this.#dbcHandle);
    yield* request.stream(chunkSize);
  }

  async beginTransaction(settings: TransactionSettings): Promise<void> {}

  async commitTransaction(): Promise<void> {}

  async rollbackTransaction(): Promise<void> {}

  async destroy(): Promise<void> {
    if (this.#dbcHandle === null) return;

    try {
      // just in case we weren't actually connected
      await odbcLib.SQLDisconnect(this.#dbcHandle);
    } catch {
      /* ignore */
    }
    odbcLib.SQLFreeHandle(HandleType.SQL_HANDLE_DBC, this.#dbcHandle);
    this.#dbcHandle = null;
  }

  async validate(): Promise<boolean> {
    if (
      this.#hasSocketError ||
      this.#isConnectionClosed() ||
      this.#dbcHandle === null
    ) {
      return false;
    }

    const compiledQuery = CompiledQuery.raw("select 1");
    const request = new OdbcRequest<unknown>(compiledQuery, this.#dbcHandle);
    try {
      await request.execute();
    } catch {
      return false;
    }

    return true;
  }

  // TODO: implement isConnectionClosed()
  #isConnectionClosed(): boolean {
    return false;
    //return "closed" in this.#connection && Boolean(this.#connection.closed);
  }

  async reset(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      /*this.#connection.reset((error) => {
        if (error) {
          return reject(error);
        }

        resolve();
      });*/
      resolve();
    });
  }
}
