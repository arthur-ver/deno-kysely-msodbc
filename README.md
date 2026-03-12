# deno-kysely-msodbcsql

[![Deno](https://img.shields.io/badge/Deno-000?logo=deno)](https://github.com/denoland/deno)
[![JSR](https://jsr.io/badges/@arthur-ver/deno-kysely-msodbcsql)](https://jsr.io/@arthur-ver/deno-kysely-msodbcsql)
[![JSR](https://jsr.io/badges/@arthur-ver/deno-kysely-msodbcsql/total-downloads)](https://jsr.io/badges/@arthur-ver/deno-kysely-msodbcsql)
![License](https://img.shields.io/github/license/arthur-ver/deno-kysely-msodbcsql)

`deno-kysely-msodbcsql` is a [Deno](https://github.com/denoland/deno)-specific
[Kysely](https://github.com/kysely-org/kysely) dialect for **MSSQL** that binds
to the native
[Microsoft ODBC Driver for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
using Deno FFI. [Tarn.js](https://github.com/Vincit/tarn.js) is used for
connection pooling.

## Prerequisites

> [!IMPORTANT]
> **System Requirement:** You must have the
> [Microsoft ODBC Driver for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
> installed on your OS.

> [!IMPORTANT]
> **Deno Permission:** The `--allow-ffi` flag is required.

## Installation

```console
deno add jsr:@kysely/kysely jsr:@arthur-ver/deno-kysely-msodbcsql
```

## Usage

```ts
import { type Generated, Kysely } from "@kysely/kysely";
import { MssqlOdbcDialect } from "@arthur-ver/deno-kysely-msodbcsql";

interface UserTable {
  id: Generated<number>;
  username: string;
}

interface Database {
  user: UserTable;
}

const db = new Kysely<Database>({
  dialect: new MssqlOdbcDialect({
    tarn: {
      options: {
        min: 0,
        max: 10,
      },
    },
    odbc: {
      libPath: "/opt/homebrew/lib/libmsodbcsql.18.dylib",
      connectionString: [
        "driver={ODBC Driver 18 for SQL Server}",
        "server=<host>",
        "database=<db>",
        "uid=<username>",
        "pwd=<password>",
        "encrypt=yes",
        "trustServerCertificate=yes",
      ].join(";"),
    },
  }),
});

const users = await db.selectFrom("user").selectAll().execute();
```

## Configuration

### `tarn.options`

[Tarn.js](https://github.com/vincit/tarn.js)' pool options, excluding `create`,
`destroy` and `validate` functions.

### `odbc.libPath`

The `libPath` property points directly to the dynamic library file of the
Microsoft ODBC Driver installed on your system. The exact path depends on your
operating system:

| OS          | Path                                                        |
| :---------- | :---------------------------------------------------------- |
| **Windows** | `C:\Windows\System32\msodbcsql18.dll`                       |
| **macOS**   | `/opt/homebrew/lib/libmsodbcsql.18.dylib`                   |
| **Linux**   | `/opt/microsoft/msodbcsql18/lib64/libmsodbcsql-18.X.so.X.X` |

### `odbc.connectionString`

A typical connection string configuration includes:

- `driver`: Must match the installed driver name (e.g.,
  `{ODBC Driver 18 for SQL
  Server}`).
- `server`: Your database host or IP address.
- `database`: The specific database name to connect to.
- `uid` / `pwd`: Authentication credentials.
- `encrypt` / `trustServerCertificate`: Often required for local or cloud
  setups.

Please refer to the
[official Microsoft ODBC Driver documentation](https://learn.microsoft.com/en-us/sql/connect/odbc/dsn-connection-string-attribute)
for a list of all available Connection String Keywords.

## Supported Data Types

### Deno → SQL

| Deno                                 | ODBC C Type                    | ODBC SQL Type       | Notes                                                     |
| :----------------------------------- | :----------------------------- | :------------------ | :-------------------------------------------------------- |
| **`null` / `undefined`**             | -                              | `NULL`              | -                                                         |
| **`boolean`**                        | `SQL_C_BIT`                    | `BIT`               | -                                                         |
| **`number`**                         | `SQL_C_SLONG` / `SQL_C_DOUBLE` | `INTEGER` / `FLOAT` | Mapped automatically between integer and float.           |
| **`bigint`**                         | `SQL_C_SBIGINT`                | `BIGINT`            | -                                                         |
| **`string`**                         | `SQL_C_WCHAR`                  | `WVARCHAR`          | In JS strings are encoded in UTF-16. Supports large data. |
| **`Uint8Array` / `ArrayBufferView`** | `SQL_C_BINARY`                 | `VARBINARY`         | Supports large data.                                      |
| **`Date`**                           | `SQL_C_TYPE_TIMESTAMP`         | `TYPE_TIMESTAMP`    | -                                                         |

### SQL → Deno

| ODBC SQL Type                                                                       | ODBC C Type                                                        | Deno         | Notes                                                     |
| :---------------------------------------------------------------------------------- | :----------------------------------------------------------------- | :----------- | :-------------------------------------------------------- |
| **`NULL`**                                                                          | -                                                                  | `null`       | -                                                         |
| **`BIT`**                                                                           | `SQL_C_BIT`                                                        | `boolean`    | -                                                         |
| **`INTEGER`** / **`FLOAT`** / **`SMALLINT`** / **`TINYINT`**                        | `SQL_C_SLONG` / `SQL_C_DOUBLE` / `SQL_C_SSHORT` / `SQL_C_UTINYINT` | `number`     | -                                                         |
| **`BIGINT`**                                                                        | `SQL_C_SBIGINT`                                                    | `bigint`     | -                                                         |
| **`NUMERIC`, `SQL_DECIMAL`**                                                        | `SQL_C_WCHAR`                                                      | `string`     | Fetched as strings to avoid precision loss.               |
| **`CHAR`, `VARCHAR`, `LONGVARCHAR`**<br>**`SQL_WCHAR`, `WVARCHAR`, `WLONGVARCHAR`** | `SQL_C_WCHAR`                                                      | `string`     | In JS strings are encoded in UTF-16. Supports large data. |
| **`BINARY`, `VARBINARY`, `LONGVARBINARY`**                                          | `SQL_C_BINARY`                                                     | `Uint8Array` | Supports large data.                                      |
| **`TYPE_DATE`, `TIMESTAMP`**                                                        | `SQL_C_WCHAR`                                                      | `Date`       | -                                                         |
