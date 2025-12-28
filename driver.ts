import { Pool } from "tarn";
import {
  DatabaseConnection,
  Driver,
  TransactionSettings,
} from "@kysely/kysely";
import { odbcLib, allocHandle, SQL_HANDLE_ENV } from "./ffi.ts";

import { OdbcConnection } from "./connection.ts";

export interface OdbcDialectConfig {
  connectionString: string;
  pool?: {
    min: number;
    max: number;
  };
}

export class OdbcDriver implements Driver {
  readonly #config: OdbcDialectConfig;
  readonly #pool: Pool<OdbcConnection>;

  #envHandle: Deno.PointerValue = null;

  constructor(config: OdbcDialectConfig) {
    this.#config = Object.freeze({ ...config });

    this.#pool = new Pool({
      min: this.#config.pool?.min ?? 0,
      max: this.#config.pool?.max ?? 10,
      create: async () => {
        if (this.#envHandle === null) {
          throw new Error("Driver not initialized: envHandle is missing");
        }
        const connection = new OdbcConnection(
          this.#config.connectionString,
          this.#envHandle
        );
        await connection.connect();
        return connection;
      },
      destroy: async (connection) => {
        await connection.destroy();
      },
      validate: undefined,
    });
  }

  async init(): Promise<void> {
    this.#envHandle = await allocHandle(SQL_HANDLE_ENV, null);
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return await this.#pool.acquire().promise;
  }

  async beginTransaction(
    connection: OdbcConnection,
    settings: TransactionSettings
  ): Promise<void> {
    await connection.beginTransaction(settings);
  }

  async commitTransaction(connection: OdbcConnection): Promise<void> {
    await connection.commitTransaction();
  }

  async rollbackTransaction(connection: OdbcConnection): Promise<void> {
    await connection.rollbackTransaction();
  }

  async releaseConnection(connection: OdbcConnection): Promise<void> {
    this.#pool.release(connection);
  }

  async destroy(): Promise<void> {
    await this.#pool.destroy();

    if (this.#envHandle === null) return;

    await odbcLib.symbols.SQLFreeHandle(SQL_HANDLE_ENV, this.#envHandle);
    this.#envHandle = null;
  }
}
