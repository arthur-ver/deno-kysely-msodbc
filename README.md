# 🚧 deno-kysely-msodbc (WIP)

> **Native MSSQL support for Kysely on Deno:** Bypass Node.js compatibility
> layers by binding directly to the Microsoft ODBC Driver via Deno FFI.

![Deno](https://img.shields.io/badge/deno-000000?style=for-the-badge&logo=deno&logoColor=white)
![WIP](https://img.shields.io/badge/Status-WIP-orange?style=for-the-badge)

## 💡 Why?

Currently, connecting Deno to MSSQL requires relying on Deno's Node.js
compatibility layer to run libraries like `npm:mssql` or `npm:tedious`. These
libraries offer no official support for Deno and frequently suffer from
unresolved compatibility issues. While the Deno ecosystem is maturing, native
MSSQL support remains a missing piece.

**This project takes a different approach.**

Instead of using Node.js libraries, we leverage **Deno FFI (Foreign Function
Interface)** to talk directly to the OS-level **Microsoft ODBC Driver**. This
results in a "pure" Deno implementation that interacts with the database at the
C-level.

## Prerequisites

> [!IMPORTANT]
> This library requires the **Microsoft ODBC Driver for SQL Server** to be
> installed on your system.

## Usage

```ts
import { MssqlOdbcDialect } from "./mod.ts";

const dialect = new MssqlOdbcDialect({
  tarn: {
    options: {
      min: 0,
      max: 10,
    },
  },
  odbc: {
    libPath: "/opt/homebrew/lib/libmsodbcsql.18.dylib",
    connString: [
      "driver={ODBC Driver 18 for SQL Server}",
      "server=127.0.0.1",
      "uid=sa",
      "pwd=Test1234$",
      "encrypt=yes",
      "trustServerCertificate=yes",
    ].join(";"),
  },
});

const db = new Kysely()<Database>({ dialect });
```

> **Note:** `--allow-ffi` permission is required.

## Supported Data Types

> [!IMPORTANT]
> Any SQL type not listed above will throw an `Unsupported SQL dataType` error.
> It is your responsibility to check the data types you are sending or
> retrieving!

### Parameters (Input)

JavaScript parameter types are mapped to the following SQL types:

| JS Input                             | ODBC C Type            | Mapped SQL Type  | Notes                                                     |
| :----------------------------------- | :--------------------- | :--------------- | :-------------------------------------------------------- |
| **`null` / `undefined`**             | -                      | -                | Inserted as `NULL`                                        |
| **`boolean`**                        | `SQL_C_BIT`            | `BIT`            | -                                                         |
| **`number` (Int32)**                 | `SQL_C_SLONG`          | `INTEGER`        | -                                                         |
| **`bigint` / `number` (Int64)**      | `SQL_C_SBIGINT`        | `BIGINT`         | -                                                         |
| **`number` (Float)**                 | `SQL_C_DOUBLE`         | `FLOAT`          | -                                                         |
| **`string`**                         | `SQL_C_WCHAR`          | `WVARCHAR`       | Converted to UTF-16                                       |
| **`Date`**                           | `SQL_C_TYPE_TIMESTAMP` | `TYPE_TIMESTAMP` | Sent as UTC struct. Maps to `DATETIME2` (100ns precision) |
| **`Uint8Array` / `ArrayBufferView`** | `SQL_C_BINARY`         | `VARBINARY`      | -                                                         |

### Retrieval (Output)

| SQL Type                                                                            | ODBC C Type      | Mapped JS Type | Notes                                            |
| :---------------------------------------------------------------------------------- | :--------------- | :------------- | :----------------------------------------------- |
| **`NULL`**                                                                          | -                | `null`         | -                                                |
| **`BIT`**                                                                           | `SQL_C_BIT`      | `boolean`      | -                                                |
| **`INTEGER`**                                                                       | `SQL_C_SLONG`    | `number`       | 32-bit signed integer.                           |
| **`BIGINT`**                                                                        | `SQL_C_SBIGINT`  | `bigint`       | 64-bit signed integer.                           |
| **`SMALLINT`**                                                                      | `SQL_C_SSHORT`   | `number`       | 16-bit signed integer.                           |
| **`TINYINT`**                                                                       | `SQL_C_UTINYINT` | `number`       | 8-bit **unsigned** integer (0-255).              |
| **`FLOAT`**                                                                         | `SQL_C_DOUBLE`   | `number`       | Double-precision floating point.                 |
| **`NUMERIC`, `SQL_DECIMAL`**                                                        | `SQL_C_WCHAR`    | `string`       | Fetched as strings to preserve full precision.   |
| **`CHAR`, `VARCHAR`, `LONGVARCHAR`**<br>**`SQL_WCHAR`, `WVARCHAR`, `WLONGVARCHAR`** | `SQL_C_WCHAR`    | `string`       | All text types are normalized to UTF-16 strings. |
| **`TYPE_DATE`, `TIMESTAMP`**                                                        | `SQL_C_WCHAR`    | `string`       | Fetched as text strings (ISO format).            |
| **`BINARY`, `VARBINARY`, `LONGVARBINARY`**                                          | `SQL_C_BINARY`   | `Uint8Array`   | Returns a copy of the raw binary bytes.          |

## Architecture

```mermaid
flowchart LR
    Kysely[Kysely Query Compiler] <--> Driver[This Driver]
    Driver <-->|Deno FFI| ODBC[libmsodbcsql.so]
    ODBC <-->|TCP/IP| SQLServer[(SQL Server)]
```
