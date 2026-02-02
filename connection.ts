import {
  CompiledQuery,
  type DatabaseConnection,
  type IsolationLevel,
  type QueryResult,
  type TransactionSettings,
} from "@kysely/kysely";
import {
  HandleType,
  type OdbcLib,
  SQL_ATTR_AUTOCOMMIT,
  SQL_ATTR_TXN_ISOLATION,
  SQL_AUTOCOMMIT_OFF,
  SQL_AUTOCOMMIT_ON,
  TxCompletionType,
  TxIsolationLevel,
} from "./odbc.ts";
import { OdbcRequest } from "./request.ts";

export class OdbcConnection implements DatabaseConnection {
  readonly #odbcLib: OdbcLib;
  readonly #connString: string;
  readonly #envHandle: Deno.PointerValue;
  #dbcHandle: Deno.PointerValue = null;
  #hasSocketError: boolean = false;

  constructor(
    odbcLib: OdbcLib,
    connString: string,
    envHandle: Deno.PointerValue,
  ) {
    this.#odbcLib = odbcLib;
    this.#connString = connString;
    this.#envHandle = envHandle;
  }

  async connect(): Promise<this> {
    this.#dbcHandle = this.#odbcLib.allocHandle(
      HandleType.SQL_HANDLE_DBC,
      this.#envHandle,
    );
    try {
      await this.#odbcLib.driverConnect(this.#connString, this.#dbcHandle);
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

  // deno-lint-ignore require-await
  async beginTransaction(settings: TransactionSettings): Promise<void> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }

    if (settings.isolationLevel) {
      this.#setIsolationLevel(settings.isolationLevel);
    }

    this.#odbcLib.setConnectAttr(
      this.#dbcHandle,
      SQL_ATTR_AUTOCOMMIT,
      Deno.UnsafePointer.create(SQL_AUTOCOMMIT_OFF),
    );
  }

  async commitTransaction(): Promise<void> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }

    try {
      await this.#odbcLib.endTransaction(
        this.#dbcHandle,
        TxCompletionType.SQL_COMMIT,
      );
    } finally {
      this.#cleanupTransactionState();
    }
  }

  async rollbackTransaction(savepointName?: string): Promise<void> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }

    if (savepointName) {
      this.#validateSavepointName(savepointName);

      const compiledQuery = CompiledQuery.raw(
        `ROLLBACK TRANSACTION ${savepointName}`,
      );
      const request = new OdbcRequest<unknown>(
        this.#odbcLib,
        compiledQuery,
        this.#dbcHandle,
      );
      await request.execute();
      // NOTE: This leaves the transaction ACTIVE, so we do NOT call cleanupTransactionState().
    } else {
      try {
        await this.#odbcLib.endTransaction(
          this.#dbcHandle,
          TxCompletionType.SQL_ROLLBACK,
        );
      } finally {
        this.#cleanupTransactionState();
      }
    }
  }

  async savepoint(savepointName: string): Promise<void> {
    if (!this.#dbcHandle) {
      throw new Error("Connection is closed");
    }

    this.#validateSavepointName(savepointName);

    const compiledQuery = CompiledQuery.raw(
      `SAVE TRANSACTION ${savepointName}`,
    );
    const request = new OdbcRequest<unknown>(
      this.#odbcLib,
      compiledQuery,
      this.#dbcHandle,
    );
    await request.execute();
  }

  async destroy(): Promise<void> {
    if (this.#dbcHandle === null) return;

    try {
      await this.#odbcLib.disconnect(this.#dbcHandle);
    } finally {
      this.#odbcLib.freeHandle(HandleType.SQL_HANDLE_DBC, this.#dbcHandle);
      this.#dbcHandle = null;
    }
  }

  async validate(): Promise<boolean> {
    if (this.#hasSocketError || this.#dbcHandle === null) {
      return false;
    }

    try {
      const compiledQuery = CompiledQuery.raw("select 1");
      const request = new OdbcRequest<unknown>(
        this.#odbcLib,
        compiledQuery,
        this.#dbcHandle,
      );
      await request.execute();

      return true;
    } catch {
      return false;
    }
  }

  async reset(): Promise<void> {
    if (this.#dbcHandle === null) return;
    await this.rollbackTransaction();
  }

  #cleanupTransactionState(): void {
    this.#setIsolationLevel("read committed");
    this.#odbcLib.setConnectAttr(
      this.#dbcHandle,
      SQL_ATTR_AUTOCOMMIT,
      Deno.UnsafePointer.create(SQL_AUTOCOMMIT_ON),
    );
  }

  #setIsolationLevel(level: IsolationLevel): void {
    let isolationLevel: TxIsolationLevel;

    switch (level) {
      case "read uncommitted":
        isolationLevel = TxIsolationLevel.SQL_TRANSACTION_READ_UNCOMMITTED;
        break;
      case "read committed":
        isolationLevel = TxIsolationLevel.SQL_TRANSACTION_READ_COMMITTED;
        break;
      case "repeatable read":
        isolationLevel = TxIsolationLevel.SQL_TRANSACTION_REPEATABLE_READ;
        break;
      case "serializable":
        isolationLevel = TxIsolationLevel.SQL_TRANSACTION_SERIALIZABLE;
        break;
      // TODO: SQL_TXN_SS_SNAPSHOT
      default:
        throw new Error(`Unsupported isolation level: ${level}`);
    }

    const isolationLevelPtr = Deno.UnsafePointer.create(BigInt(isolationLevel));

    this.#odbcLib.setConnectAttr(
      this.#dbcHandle,
      SQL_ATTR_TXN_ISOLATION,
      isolationLevelPtr,
    );
  }

  #validateSavepointName(savepointName: string) {
    if (!/^[a-zA-Z0-9_]+$/.test(savepointName)) {
      throw new Error(
        `Security Error: Invalid savepoint name "${savepointName}"`,
      );
    }
  }
}
