import { type Generated, Kysely, sql } from "@kysely/kysely";
import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import { MssqlOdbcDialect } from "./dialect.ts";

// ➤ INTERFACES & CONFIGURATION

interface TestTable {
  id: Generated<number>;
  col_bit: boolean | null;
  col_int: number | null;
  col_bigint: bigint | null;
  col_float: number | null;
  col_string: string | null;
  col_date: Date | null;
  col_binary: Uint8Array | null;
  col_smallint: number | null;
  col_tinyint: number | null;
  col_decimal: string | null;
  long_str: string | null;
  long_bin: Uint8Array | null;
}

interface Database {
  test_table: TestTable;
}

const TABLE_NAME = "test_table";
const MAX_POOL_SIZE = 5;
const SLEEP_MS = 500;

// ➤ TEST DATA

const INPUT_DATE = new Date();
const INPUT_BOOLEAN = true;
const INPUT_INT = 2147483647;
const INPUT_FLOAT = 123.456;
const INPUT_BIGINT = 9007199254740991n;
const INPUT_BINARY = new Uint8Array([1, 2, 3, 255]);
const INPUT_STRING = "Deno 🦕 + SQL Server";
const INPUT_SMALLINT = 32000;
const INPUT_TINYINT = 255;
const INPUT_DECIMAL = "9999.99";

let db: Kysely<Database>;

// ➤ SETUP & TEARDOWN

Deno.test.beforeAll(async () => {
  console.log("Setting up test database...");

  db = new Kysely<Database>({
    dialect: new MssqlOdbcDialect({
      tarn: {
        options: {
          min: 0,
          max: MAX_POOL_SIZE,
          propagateCreateError: true,
        },
      },
      odbc: {
        libPath: Deno.env.get("MSODBC_LIB")!,
        connString: [
          "driver={ODBC Driver 18 for SQL Server}",
          "server=127.0.0.1",
          "uid=sa",
          "pwd=Test1234$",
          "encrypt=yes",
          "trustServerCertificate=yes",
        ].join(";"),
      },
    }),
  });

  await db.schema.dropTable(TABLE_NAME).ifExists().execute();

  await db.schema.createTable(TABLE_NAME)
    .addColumn("id", "integer", (col) => col.identity().primaryKey())
    .addColumn("col_bit", sql`bit`)
    .addColumn("col_int", "integer")
    .addColumn("col_bigint", "bigint")
    .addColumn("col_float", sql`float`)
    .addColumn("col_string", sql`nvarchar(255)`)
    .addColumn("col_date", sql`datetime2`)
    .addColumn("col_binary", sql`varbinary(max)`)
    .addColumn("col_smallint", "smallint")
    .addColumn("col_tinyint", sql`tinyint`)
    .addColumn("col_decimal", "decimal(10, 2)")
    .addColumn("long_str", sql`nvarchar(max)`)
    .addColumn("long_bin", sql`varbinary(max)`)
    .execute();
});

Deno.test.afterAll(async () => {
  console.log("Tearing down test database...");

  await db.schema.dropTable(TABLE_NAME).ifExists().execute();
  await db.destroy();
});

// ➤ TESTS

Deno.test("➤ CONNECTION POOL", async (t) => {
  /**
   * Verifies that the pool can successfully open (or reuse) connections simultaneously.
   */
  await t.step("simultaneous connections", async () => {
    const uniqueSessions = new Set<number>();

    await Promise.all(
      Array.from({ length: MAX_POOL_SIZE }).map(async () => {
        await db.transaction().execute(async (trx) => {
          const { rows } = await sql<{ spid: number }>`SELECT @@SPID as spid`
            .execute(trx);

          uniqueSessions.add(rows[0].spid);
          await new Promise((r) => setTimeout(r, SLEEP_MS));
        });
      }),
    );

    assertEquals(
      uniqueSessions.size,
      5,
      `Expected 5 unique sessions, but got ${uniqueSessions.size}. SPIDs: ${
        [...uniqueSessions].join(",")
      }`,
    );
  });

  /**
   * Verifies that the pool enforces the `max` connection limit by queuing excess requests.
   */
  await t.step("max connection enforcement", async () => {
    const requests = 15;
    const buffer = 50;

    // Theoretical minimum if queuing works perfectly:
    const minExpectedDuration = Math.ceil(requests / MAX_POOL_SIZE) * SLEEP_MS;
    const start = performance.now();

    await Promise.all(
      Array.from({ length: requests }).map(async () => {
        const delayString = `00:00:00.${SLEEP_MS}`;
        await sql`WAITFOR DELAY ${delayString}; SELECT 1`.execute(db);
      }),
    );

    const duration = performance.now() - start;

    assertEquals(
      duration > (minExpectedDuration - buffer),
      true,
      `Pool failed to queue! Expected >${minExpectedDuration}ms (3 batches), but finished in ${duration}ms`,
    );
  });

  /**
   * Verifies that the pool cleans up connection state (specifically Isolation Level) upon release.
   */
  await t.step("state cleanup on connection release", async () => {
    await Promise.all(
      Array.from({ length: MAX_POOL_SIZE }).map(async () => {
        await db
          .transaction()
          .setIsolationLevel("serializable")
          .execute(async (trx) => {
            const delayString = `00:00:00.${SLEEP_MS}`;
            await sql`WAITFOR DELAY ${delayString}; SELECT 1`.execute(trx);
          });
      }),
    );

    const { rows } = await sql<{ level: number }>`
        SELECT transaction_isolation_level as level
        FROM sys.dm_exec_sessions 
        WHERE session_id = @@SPID
      `.execute(db);

    assertEquals(
      rows[0]?.level,
      2,
      "A recycled connection retained 'Serializable' (4) state instead of resetting to 'ReadCommitted' (2).",
    );
  });
});

Deno.test("➤ TRANSACTIONS", async (t) => {
  /**
   * Verifies that data persists after a successful transaction.
   */
  await t.step("successful commit", async () => {
    const col_string = "ACID Commit Test";

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto(TABLE_NAME)
        .values({
          col_string,
        })
        .execute();
    });

    const result = await db
      .selectFrom(TABLE_NAME)
      .where("col_string", "=", col_string)
      .select("col_string")
      .executeTakeFirst();

    assertEquals(
      result?.col_string,
      col_string,
      "Data should exist after commit.",
    );
  });

  /**
   * Verifies that data is reverted when an error occurs.
   */
  await t.step("rollback on failure", async () => {
    const col_string = "ACID Rollback Test";

    await assertRejects(
      async () => {
        await db.transaction().execute(async (trx) => {
          await trx
            .insertInto(TABLE_NAME)
            .values({
              col_string,
            })
            .execute();

          throw new Error("Trigger Rollback");
        });
      },
      Error,
      "Trigger Rollback",
    );

    const result = await db
      .selectFrom(TABLE_NAME)
      .where("col_string", "=", col_string)
      .select("col_string")
      .executeTakeFirst();

    assertEquals(result, undefined, "Data should NOT exist after rollback.");
  });

  /**
   * Verifies that rolling back to a savepoint is working.
   */
  await t.step("partial rollback using a savepoint", async () => {
    const firstInsertString = "First Insert";
    const secondInsertString = "Second Insert";
    const thirdInsertString = "Third Insert";

    const trx = await db.startTransaction().execute();

    // 1. First Insert (Persisted)
    await trx
      .insertInto(TABLE_NAME)
      .values({ col_string: firstInsertString })
      .executeTakeFirstOrThrow();

    // 2. Create Savepoint
    const spTrx = await trx.savepoint("after_first_insert").execute();

    // 3. Second Insert (Reverted)
    try {
      await spTrx
        .insertInto(TABLE_NAME)
        .values({ col_string: secondInsertString })
        .executeTakeFirstOrThrow();

      throw new Error("Simulated Error");
    } catch (_error) {
      await spTrx.rollbackToSavepoint("after_first_insert").execute();
    }

    // 4. Third Insert (Persisted)
    await trx
      .insertInto(TABLE_NAME)
      .values({ col_string: thirdInsertString })
      .execute();

    await trx.commit().execute();

    const rows = await db
      .selectFrom(TABLE_NAME)
      .where("col_string", "in", [
        firstInsertString,
        secondInsertString,
        thirdInsertString,
      ])
      .select(["col_string"])
      .execute();

    const hasSecond = rows.some((r) => r.col_string === secondInsertString);

    assertEquals(
      hasSecond,
      false,
      `"${secondInsertString}" should NOT exist (Rolled back).`,
    );
  });
});

Deno.test("➤ DATA TYPES", async (t) => {
  await t.step("boolean / BIT", async () => {
    await db.insertInto(TABLE_NAME).values({ col_bit: INPUT_BOOLEAN })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_bit").where(
      "col_bit",
      "=",
      INPUT_BOOLEAN,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_bit, "boolean");
    assertEquals(row.col_bit, INPUT_BOOLEAN);
  });

  await t.step("number / INT", async () => {
    await db.insertInto(TABLE_NAME).values({ col_int: INPUT_INT })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_int").where(
      "col_int",
      "=",
      INPUT_INT,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_int, "number");
    assertEquals(row.col_int, INPUT_INT);
  });

  await t.step("number / SMALLINT", async () => {
    await db.insertInto(TABLE_NAME).values({ col_smallint: INPUT_SMALLINT })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_smallint").where(
      "col_smallint",
      "=",
      INPUT_SMALLINT,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_smallint, "number");
    assertEquals(row.col_smallint, INPUT_SMALLINT);
  });

  await t.step("number / TINYINT", async () => {
    await db.insertInto(TABLE_NAME).values({ col_tinyint: INPUT_TINYINT })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_tinyint").where(
      "col_tinyint",
      "=",
      INPUT_TINYINT,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_tinyint, "number");
    assertEquals(row.col_tinyint, INPUT_TINYINT);
  });

  await t.step("number / FLOAT", async () => {
    await db.insertInto(TABLE_NAME).values({ col_float: INPUT_FLOAT })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_float").where(
      "col_float",
      "=",
      INPUT_FLOAT,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_float, "number");
    assertEquals(row.col_float, INPUT_FLOAT);
  });

  await t.step("bigint / BIGINT", async () => {
    await db.insertInto(TABLE_NAME).values({ col_bigint: INPUT_BIGINT })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_bigint").where(
      "col_bigint",
      "=",
      INPUT_BIGINT,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_bigint, "bigint");
    assertEquals(row.col_bigint, INPUT_BIGINT);
  });

  await t.step("string / NVARCHAR", async () => {
    await db.insertInto(TABLE_NAME).values({ col_string: INPUT_STRING })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_string").where(
      "col_string",
      "=",
      INPUT_STRING,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_string, "string");
    assertEquals(row.col_string, INPUT_STRING);
  });

  await t.step("Date / DATETIME2", async () => {
    await db.insertInto(TABLE_NAME).values({ col_date: INPUT_DATE })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_date").where(
      "col_date",
      "=",
      INPUT_DATE,
    ).executeTakeFirstOrThrow();

    assertInstanceOf(row.col_date, Date);
    assertEquals(row.col_date.getTime(), INPUT_DATE.getTime());
  });

  await t.step("Uint8Array / VARBINARY", async () => {
    await db.insertInto(TABLE_NAME).values({ col_binary: INPUT_BINARY })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_binary").where(
      "col_binary",
      "=",
      INPUT_BINARY,
    ).executeTakeFirstOrThrow();

    assertInstanceOf(row.col_binary, Uint8Array);
    assertEquals(row.col_binary, INPUT_BINARY);
  });

  await t.step("DECIMAL", async () => {
    await db.insertInto(TABLE_NAME).values({ col_decimal: INPUT_DECIMAL })
      .execute();

    const row = await db.selectFrom(TABLE_NAME).select("col_decimal").where(
      "col_decimal",
      "=",
      INPUT_DECIMAL,
    ).executeTakeFirstOrThrow();

    assertEquals(typeof row.col_decimal, "string");
    assertEquals(row.col_decimal, INPUT_DECIMAL);
  });
});

Deno.test("➤ LARGE DATA (Truncation Handling)", async (t) => {
  const longString = "A".repeat(100_000) + "END";
  const longBinary = new Uint8Array(100_000).fill(0xA);
  longBinary[longBinary.length - 1] = 0xB; // Marker at the end

  await db.deleteFrom(TABLE_NAME).execute();

  await t.step("insert large data", async () => {
    await db.insertInto(TABLE_NAME)
      .values({
        long_str: longString,
        long_bin: longBinary,
      })
      .execute();
  });

  await t.step("fetch and verify large string (NVARCHAR MAX)", async () => {
    const row = await db.selectFrom(TABLE_NAME)
      .select("long_str")
      .executeTakeFirstOrThrow();

    assertEquals(row.long_str, longString);
  });

  await t.step("fetch and verify large binary (VARBINARY MAX)", async () => {
    const row = await db.selectFrom(TABLE_NAME)
      .select("long_bin")
      .executeTakeFirstOrThrow();

    assertEquals(row.long_bin, longBinary);
  });
});
