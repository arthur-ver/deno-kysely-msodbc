import { OdbcDialectConfig, OdbcDriver } from "./driver.ts";

import {
  type Driver,
  MssqlDialect,
  MssqlDialectConfig,
  MssqlQueryCompiler,
  QueryCompiler,
} from "@kysely/kysely";

/**
 * MS SQL Server dialect that uses the Microsoft ODBC Driver for SQL Server
 * library.
 *
 * The constructor takes an instance of {@link OdbcDialectConfig}.
 *
 * ```ts
 * const dialect = new MssqlOdbcDialect({
 *   tarn: {
 *     options: {
 *       min: 0,
 *       max: 10,
 *     },
 *   },
 *   odbc: {
 *     connString: [
 *       "driver={ODBC Driver 18 for SQL Server}",
 *       "server=127.0.0.1",
 *       "uid=sa",
 *       "pwd=Test1234$",
 *       "encrypt=yes",
 *       "trustServerCertificate=yes",
 *     ].join(";"),
 *   },
 * })
 * ```
 */
export class MssqlOdbcDialect extends MssqlDialect {
  readonly #config: OdbcDialectConfig;

  constructor(config: OdbcDialectConfig) {
    super({} as MssqlDialectConfig);
    this.#config = config;
  }

  override createDriver(): Driver {
    return new OdbcDriver(this.#config);
  }

  override createQueryCompiler(): QueryCompiler {
    return new OdbcMssqlQueryCompiler();
  }
}

class OdbcMssqlQueryCompiler extends MssqlQueryCompiler {
  protected override getCurrentParameterPlaceholder(): string {
    // ODBC uses '?' for all parameters, regardless of index.
    return "?";
  }
}
