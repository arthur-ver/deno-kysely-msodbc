import { Pool } from "tarn";
import type { PoolOptions } from "tarn/dist/Pool";

import {
  DatabaseConnection,
  Driver,
  MssqlDialectConfig,
  TransactionSettings,
} from "@kysely/kysely";
import { HandleType, OdbcLib } from "./odbc.ts";
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
  libPath: string;
  connString: string;
}

export class OdbcDriver implements Driver {
  readonly #config: OdbcDialectConfig;
  readonly #pool: Pool<OdbcConnection>;
  readonly #odbcLib: OdbcLib;

  #envHandle: Deno.PointerValue = null;

  constructor(config: OdbcDialectConfig) {
    this.#config = Object.freeze({ ...config });
    this.#odbcLib = new OdbcLib(this.#config.odbc.libPath);

    this.#pool = new Pool({
      ...this.#config.tarn.options,
      create: async () => {
        if (this.#envHandle === null) {
          throw new Error("Driver not initialized: envHandle is missing");
        }
        const connection = new OdbcConnection(
          this.#odbcLib,
          this.#config.odbc.connString,
          this.#envHandle,
        );
        await connection.connect();
        return connection;
      },
      destroy: async (connection) => {
        await connection.destroy();
      },
      // @ts-ignore `tarn` accepts a function that returns a promise here, but
      // the types are not aligned and it type errors.
      validate: this.#config.validateConnections
        ? (connection) => connection.validate()
        : undefined,
    });
  }

  async init(): Promise<void> {
    this.#envHandle = this.#odbcLib.allocHandle(
      HandleType.SQL_HANDLE_ENV,
      null,
    );
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
    if (this.#config.resetConnectionsOnRelease) {
      await connection.reset();
    }

    this.#pool.release(connection);
  }

  async destroy(): Promise<void> {
    await this.#pool.destroy();

    if (this.#envHandle === null) return;

    this.#odbcLib.freeHandle(HandleType.SQL_HANDLE_ENV, this.#envHandle);
    this.#envHandle = null;

    this.#odbcLib.close();
  }
}
