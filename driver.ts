import { Pool } from "tarn";
import type { PoolOptions } from "tarn/dist/Pool";

import {
  DatabaseConnection,
  Driver,
  MssqlDialectConfig,
  TransactionSettings,
} from "@kysely/kysely";
import { allocHandle, HandleType, odbcLib } from "./ffi.ts";
import { OdbcConnection } from "./connection.ts";

export interface OdbcDialectConfig
  extends Omit<MssqlDialectConfig, "tedious" | "tarn"> {
  odbc: Odbc;
  tarn: {
    options: Omit<
      PoolOptions<OdbcConnection>,
      "create" | "destroy" | "validate"
    >;
  };
}

export interface Odbc {
  connectionString: string;
}

export class OdbcDriver implements Driver {
  readonly #config: OdbcDialectConfig;
  readonly #pool: Pool<OdbcConnection>;

  #envHandle: Deno.PointerValue = null;

  constructor(config: OdbcDialectConfig) {
    this.#config = Object.freeze({ ...config });

    this.#pool = new Pool({
      ...this.#config.tarn.options,
      create: async () => {
        if (this.#envHandle === null) {
          throw new Error("Driver not initialized: envHandle is missing");
        }
        const connection = new OdbcConnection(
          this.#config.odbc.connectionString,
          this.#envHandle,
        );
        await connection.connect();
        return connection;
      },
      destroy: async (connection) => {
        await connection.destroy();
      },
      validate: undefined, // TODO: https://github.com/kysely-org/kysely/blob/master/src/dialect/mssql/mssql-driver.ts#L63
    });
  }

  async init(): Promise<void> {
    this.#envHandle = allocHandle(HandleType.SQL_HANDLE_ENV, null);
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return await this.#pool.acquire().promise;
  }

  async beginTransaction(
    connection: OdbcConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    await connection.beginTransaction(settings);
  }

  async commitTransaction(connection: OdbcConnection): Promise<void> {
    await connection.commitTransaction();
  }

  async rollbackTransaction(connection: OdbcConnection): Promise<void> {
    await connection.rollbackTransaction();
  }

  // TODO: async savepoint()
  // TODO: async rollbackToSavepoint()

  async releaseConnection(connection: OdbcConnection): Promise<void> {
    if (
      this.#config.resetConnectionsOnRelease
      // NOTE: deprecated code removed
      // || this.#config.tedious.resetConnectionOnRelease
    ) {
      await connection.reset();
    }

    this.#pool.release(connection);
  }

  async destroy(): Promise<void> {
    await this.#pool.destroy();

    if (this.#envHandle === null) return;

    odbcLib.SQLFreeHandle(HandleType.SQL_HANDLE_ENV, this.#envHandle);
    this.#envHandle = null;
  }
}
