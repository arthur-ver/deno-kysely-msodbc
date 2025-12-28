import {
  DatabaseIntrospector,
  Dialect,
  DialectAdapter,
  Driver,
  Kysely,
  MssqlAdapter,
  MssqlIntrospector,
  MssqlQueryCompiler,
  QueryCompiler,
} from "@kysely/kysely";
import { OdbcDialectConfig, OdbcDriver } from "./driver.ts";

export class MssqlOdbcDialect implements Dialect {
  readonly #config: OdbcDialectConfig;

  constructor(config: OdbcDialectConfig) {
    this.#config = config;
  }

  createDriver(): Driver {
    return new OdbcDriver(this.#config);
  }

  createQueryCompiler(): QueryCompiler {
    return new MssqlQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new MssqlAdapter();
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new MssqlIntrospector(db);
  }
}
