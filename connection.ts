import {
  CompiledQuery,
  DatabaseConnection,
  QueryResult,
  TransactionSettings,
} from "@kysely/kysely";
import { odbcLib, allocHandle, driverConnect, HandleType } from "./ffi.ts";
import { OdbcRequest } from "./request.ts";

export class OdbcConnection implements DatabaseConnection {
  readonly #connectionString: string;
  #hasSocketError: boolean;
  #envHandle: Deno.PointerValue;
  #dbcHandle: Deno.PointerValue = null;

  constructor(connectionString: string, envHandle: Deno.PointerValue) {
    this.#connectionString = connectionString;
    this.#hasSocketError = false;
    this.#envHandle = envHandle;
  }

  async connect(): Promise<this> {
    this.#dbcHandle = await allocHandle(
      HandleType.SQL_HANDLE_DBC,
      this.#envHandle
    );
    try {
      await driverConnect(this.#connectionString, this.#dbcHandle);
    } catch (error) {
      this.#hasSocketError = true;
      throw error;
    }
    return this;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const request = new OdbcRequest<O>(compiledQuery, this.#dbcHandle);
    const { rowCount, rows } = await request.execute();

    return {
      numAffectedRows: rowCount !== undefined ? BigInt(rowCount) : undefined,
      rows,
    };
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
      await odbcLib.SQLDisconnect(this.#dbcHandle);
    } catch {
      /* ignore */
    }
    await odbcLib.SQLFreeHandle(HandleType.SQL_HANDLE_DBC, this.#dbcHandle);
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
