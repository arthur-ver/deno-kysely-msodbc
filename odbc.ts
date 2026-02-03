export enum HandleType {
  // sql.h
  SQL_HANDLE_ENV = 1,
  SQL_HANDLE_DBC = 2,
  SQL_HANDLE_STMT = 3,
}

export enum SQLRETURN {
  // sql.h
  SQL_SUCCESS = 0,
  SQL_SUCCESS_WITH_INFO = 1,
  SQL_NO_DATA = 100,
  SQL_ERROR = -1,
  SQL_INVALID_HANDLE = -2,
  SQL_STILL_EXECUTING = 2,
  SQL_NEED_DATA = 99,
  SQL_PARAM_DATA_AVAILABLE = 101,
}

const SQL_SIGNED_OFFSET = -20;
const SQL_UNSIGNED_OFFSET = -22;

export enum SQLType {
  // sql.h
  SQL_NUMERIC = 2,
  SQL_DECIMAL = 3,
  SQL_CHAR = 1,
  SQL_INTEGER = 4,
  SQL_BIGINT = -5,
  SQL_FLOAT = 6,
  SQL_BIT = -7,
  SQL_VARCHAR = 12,
  SQL_LONGVARCHAR = -1,
  SQL_TYPE_DATE = 91,
  SQL_TYPE_TIMESTAMP = 93,
  // sqlucode.h
  SQL_WCHAR = -8,
  SQL_WVARCHAR = -9,
  SQL_WLONGVARCHAR = -10,
  // sqlext.h
  SQL_BINARY = -2,
  SQL_VARBINARY = -3,
  SQL_LONGVARBINARY = -4,
  SQL_TINYINT = -6,
  SQL_SMALLINT = 5,
}

export enum CType {
  // sqlext.h
  SQL_C_CHAR = SQLType.SQL_CHAR,
  SQL_C_DOUBLE = 8,
  SQL_C_BIT = SQLType.SQL_BIT,
  SQL_C_BINARY = SQLType.SQL_BINARY,
  SQL_C_SLONG = -16,
  SQL_C_SBIGINT = SQLType.SQL_BIGINT + SQL_SIGNED_OFFSET,
  SQL_C_UTINYINT = SQLType.SQL_TINYINT + SQL_UNSIGNED_OFFSET,
  SQL_C_SSHORT = SQLType.SQL_SMALLINT + SQL_SIGNED_OFFSET,
  SQL_C_TYPE_TIMESTAMP = SQLType.SQL_TYPE_TIMESTAMP,
  // sqlucode.h
  SQL_C_WCHAR = SQLType.SQL_WCHAR,
}

export const SQL_PARAM_INPUT = 1;
export const SQL_NULL_DATA = -1;
export const SQL_NO_TOTAL = -4;
const SQL_ATTR_ODBC_VERSION = 200;

export const SQL_DRIVER_NOPROMPT = 0;
export const SQL_NTS = -3;

export const SQL_ATTR_TXN_ISOLATION = 108;
export const SQL_ATTR_AUTOCOMMIT = 102;

export const SQL_AUTOCOMMIT_OFF = 0n;
export const SQL_AUTOCOMMIT_ON = 1n;
export const SQL_IS_INTEGER = -6;

export enum TxIsolationLevel {
  SQL_TRANSACTION_READ_UNCOMMITTED = 1,
  SQL_TRANSACTION_READ_COMMITTED = 2,
  SQL_TRANSACTION_REPEATABLE_READ = 4,
  SQL_TRANSACTION_SERIALIZABLE = 8,
}

export enum TxCompletionType {
  SQL_COMMIT = 0,
  SQL_ROLLBACK = 1,
}

const libDefinitions = {
  // --- ASYNC (I/O BOUND) ---
  SQLDriverConnectW: {
    parameters: [
      "pointer", // SQLHDBC <- in
      "pointer", // SQLHWND <- in (always NULL)
      "buffer", // SQLWCHAR * <- in
      "i16", // SQLSMALLINT <- in
      "pointer", // SQLWCHAR * -> out (always NULL, so using pointer instead of buffer)
      "i16", // SQLSMALLINT <- in
      "pointer", // SQLSMALLINT * -> out (always NULL, so using pointer instead of buffer)
      "u16", // SQLUSMALLINT <- in
    ],
    result: "i16", // SQLRETURN
    nonblocking: true,
  },
  SQLDisconnect: {
    parameters: [
      "pointer", // SQLHDBC <- in
    ],
    result: "i16", // SQLRETURN
    nonblocking: true,
  },
  SQLExecDirectW: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "buffer", // SQLWCHAR * <- in
      "i32", // SQLINTEGER <- in
    ],
    result: "i16", // SQLRETURN
    nonblocking: true,
  },
  SQLFetch: {
    parameters: [
      "pointer", // SQLHSTMT <- in
    ],
    result: "i16",
    nonblocking: true,
  },
  SQLGetData: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "u16", // SQLUSMALLINT <- in
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLPOINTER -> out
      "i64", // SQLLEN <- in
      "buffer", // SQLLEN * -> out
    ],
    result: "i16",
    nonblocking: true,
  },
  SQLEndTran: {
    parameters: [
      "i16", // SQLSMALLINT <- in
      "pointer", // SQLHANDLE <- in
      "i16", // SQLSMALLINT <- in
    ],
    result: "i16",
    nonblocking: true,
  },
  // --- SYNC (MEMORY BOUND) ---
  SQLAllocHandle: {
    parameters: [
      "i16", // SQLSMALLINT <- in
      "pointer", // SQLHANDLE <- in
      "buffer", // SQLHANDLE * -> out
    ],
    result: "i16", // SQLRETURN
  },
  SQLGetDiagRecW: {
    parameters: [
      "i16", // SQLSMALLINT <- in
      "pointer", // SQLHANDLE <- in
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLWCHAR * -> out
      "buffer", // SQLINTEGER * -> out
      "buffer", // SQLWCHAR * -> out
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLSMALLINT * -> out
    ],
    result: "i16", // SQLRETURN
  },
  SQLFreeHandle: {
    parameters: [
      "i16", // HandleType <- in
      "pointer", // SQLHANDLE <- in
    ],
    result: "i16", // SQLRETURN
  },
  SQLRowCount: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "buffer", // SQLLEN * -> out
    ],
    result: "i16", // SQLRETURN
  },
  SQLBindParameter: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "u16", // SQLUSMALLINT <- in
      "i16", // SQLSMALLINT <- in
      "i16", // SQLSMALLINT <- in
      "i16", // SQLSMALLINT <- in
      "u64", // SQLULEN <- in
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLPOINTER <- in
      "i64", // SQLLEN <- in
      "buffer", // SQLLEN * <- in
    ],
    result: "i16", // SQLRETURN
  },
  SQLNumResultCols: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "buffer", // SQLSMALLINT * -> out
    ],
    result: "i16", // SQLRETURN
  },
  SQLDescribeColW: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "u16", // SQLUSMALLINT <- in
      "buffer", // SQLCHAR * -> out
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLSMALLINT * -> out
      "buffer", // SQLSMALLINT * -> out
      "buffer", // SQLULEN * -> out
      "buffer", // SQLSMALLINT * -> out
      "buffer", // SQLSMALLINT * -> out
    ],
    result: "i16", // SQLRETURN
  },
  SQLBindCol: {
    parameters: [
      "pointer", // SQLHSTMT <- in
      "u16", // SQLUSMALLINT <- in
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLPOINTER <- in
      "i64", // SQLLEN <- in
      "buffer", // SQLLEN * <- in
    ],
    result: "i16",
  },
  SQLSetConnectAttrW: {
    parameters: [
      "pointer", // SQLHDBC <- in
      "i32", // SQLINTEGER <- in
      "pointer", // SQLPOINTER <- in
      "i32", // SQLINTEGER <- in
    ],
    result: "i16",
  },
  SQLSetEnvAttr: {
    parameters: [
      "pointer", // SQLHENV <- in
      "i32", // SQLINTEGER <- in
      "pointer", // SQLPOINTER <- in
      "i32", // SQLINTEGER <- in
    ],
    result: "i16",
  },
  SQLGetInfoW: {
    parameters: [
      "pointer", // SQLHDBC <- in
      "u16", // SQLUSMALLINT <- in
      "buffer", // SQLPOINTER -> out
      "i16", // SQLSMALLINT <- in
      "buffer", // SQLSMALLINT * -> out
    ],
    result: "i16",
  },
} as const;

export class OdbcLib {
  readonly #dylib: Deno.DynamicLibrary<typeof libDefinitions>;
  readonly #symbols: OdbcSymbols;

  constructor(libPath: string) {
    this.#dylib = Deno.dlopen(libPath, libDefinitions);
    this.#symbols = this.#dylib.symbols;
  }

  allocHandle(
    handleType: HandleType,
    parentHandle: Deno.PointerValue,
  ): Deno.PointerValue {
    const outHandleBuf = new BigUint64Array(1);

    const status = this.#symbols.SQLAllocHandle(
      handleType,
      parentHandle,
      outHandleBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(`SQLAllocHandle failed: ${SQLRETURN[status]}`);
    }

    const handleAddress = outHandleBuf[0];
    if (handleAddress === 0n) {
      throw new Error(
        `SQLAllocHandle returned invalid (null) handle (Type: ${
          HandleType[handleType]
        })`,
      );
    }

    return Deno.UnsafePointer.create(handleAddress);
  }

  freeHandle(handleType: HandleType, handle: Deno.PointerValue): void {
    const status = this.#symbols.SQLFreeHandle(handleType, handle);

    if (
      status !== SQLRETURN.SQL_SUCCESS
    ) {
      throw new Error(`SQLFreeHandle failed: ${SQLRETURN[status]}`);
    }
  }

  setOdbcV3(envHandle: Deno.PointerValue): void {
    const status = this.#symbols.SQLSetEnvAttr(
      envHandle,
      SQL_ATTR_ODBC_VERSION,
      Deno.UnsafePointer.create(3n),
      0, // ignored
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      const errorDetail = this.getOdbcError(
        HandleType.SQL_HANDLE_ENV,
        envHandle,
      );
      throw new Error(`SQLSetEnvAttr failed:\n${errorDetail}`);
    }
  }

  async driverConnect(
    connStr: string,
    dbcHandle: Deno.PointerValue,
  ): Promise<void> {
    const connStrEncoded = strToBuf(connStr);

    const status = await this.#symbols.SQLDriverConnectW(
      dbcHandle,
      null,
      connStrEncoded,
      SQL_NTS,
      null,
      0,
      null,
      SQL_DRIVER_NOPROMPT,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      const errorDetail = this.getOdbcError(
        HandleType.SQL_HANDLE_DBC,
        dbcHandle,
      );
      throw new Error(`SQLDriverConnectW failed:\n${errorDetail}`);
    }
  }

  async disconnect(dbcHandle: Deno.PointerValue) {
    const status = await this.#symbols.SQLDisconnect(dbcHandle);

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      const errorDetail = this.getOdbcError(
        HandleType.SQL_HANDLE_DBC,
        dbcHandle,
      );
      throw new Error(`SQLDisconnect failed:\n${errorDetail}`);
    }
  }

  async execDirect(
    rawSql: string,
    stmtHandle: Deno.PointerValue,
  ): Promise<{ colCount: number; numAffectedRows: bigint }> {
    const rawSqlEncoded = strToBuf(rawSql);
    const status = await this.#symbols.SQLExecDirectW(
      stmtHandle,
      rawSqlEncoded,
      SQL_NTS,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO &&
      status !== SQLRETURN.SQL_NO_DATA
    ) {
      throw new Error(
        `Execution Error: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            stmtHandle,
          )
        }\nSQL: ${rawSql}`,
      );
    }

    return {
      colCount: this.numResultCols(stmtHandle),
      numAffectedRows: this.rowCount(stmtHandle),
    };
  }

  rowCount(stmtHandle: Deno.PointerValue): bigint {
    const rowCountBuf = new BigInt64Array(1);

    const status = this.#symbols.SQLRowCount(
      stmtHandle,
      rowCountBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(`SQLRowCount failed: ${SQLRETURN[status]}`);
    }

    return rowCountBuf[0];
  }

  getOdbcError(
    handleType: HandleType,
    handle: Deno.PointerValue,
  ): string {
    const errors: string[] = [];
    let i = 1;

    while (true) {
      const stateBuf = new Uint16Array(6);
      const nativeErrBuf = new Int32Array(1);
      const msgBuf = new Uint16Array(512);
      const msgLenBuf = new Int16Array(1);

      const status = this.#symbols.SQLGetDiagRecW(
        handleType,
        handle,
        i,
        stateBuf,
        nativeErrBuf,
        msgBuf,
        msgBuf.length,
        msgLenBuf,
      );

      if (status === SQLRETURN.SQL_NO_DATA) break;

      const state = bufToStr(stateBuf, 5);
      const msg = bufToStr(msgBuf, msgLenBuf[0]);

      errors.push(`[${state}] ${msg} (Code: ${nativeErrBuf[0]})`);
      i++;
    }

    return errors.length > 0 ? errors.join("\n") : "Unknown ODBC Error";
  }

  bindParameter(
    stmtHandle: Deno.PointerValue,
    i: number,
    cType: CType,
    sqlType: SQLType,
    columnSize: bigint,
    decimalDigits: number,
    buf: BufferSource,
    bufLen: bigint,
    indLenBuf: BufferSource,
  ): void {
    const status = this.#symbols.SQLBindParameter(
      stmtHandle,
      i,
      SQL_PARAM_INPUT,
      cType,
      sqlType,
      columnSize,
      decimalDigits,
      buf,
      bufLen,
      indLenBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(
        `SQLBindParameter failed: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            stmtHandle,
          )
        }\n`,
      );
    }
  }

  numResultCols(
    stmtHandle: Deno.PointerValue,
  ): number {
    const colCountBuf = new Int16Array(1);

    const status = this.#symbols.SQLNumResultCols(
      stmtHandle,
      colCountBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(`SQLNumResultCols failed: ${SQLRETURN[status]}`);
    }

    return colCountBuf[0];
  }

  describeCol(
    stmtHandle: Deno.PointerValue,
    colNumber: number,
  ): {
    colName: string;
    sqlType: number;
    colSize: bigint;
    decimalDigits: number;
    isNullable: boolean;
  } {
    const CHAR_LIMIT = 256;

    const nameBuf = new Uint16Array(CHAR_LIMIT);
    const nameLenIndBuf = new Int16Array(1);
    const dataTypeBuf = new Int16Array(1);
    const columnSizeBuf = new BigUint64Array(1);
    const decimalDigitsBuf = new Int16Array(1);
    const nullableBuf = new Int16Array(1);

    const status = this.#symbols.SQLDescribeColW(
      stmtHandle,
      colNumber,
      nameBuf,
      CHAR_LIMIT,
      nameLenIndBuf,
      dataTypeBuf,
      columnSizeBuf,
      decimalDigitsBuf,
      nullableBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(
        `SQLDescribeColW failed: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            stmtHandle,
          )
        }\n`,
      );
    }

    const colName = bufToStr(nameBuf, nameLenIndBuf[0]);

    return {
      colName,
      sqlType: dataTypeBuf[0],
      colSize: columnSizeBuf[0],
      decimalDigits: decimalDigitsBuf[0],
      isNullable: nullableBuf[0] === 1,
    };
  }

  bindCol(
    stmtHandle: Deno.PointerValue,
    i: number,
    cType: CType,
    buf: BufferSource,
    bufLen: bigint,
    indLenBuf: BufferSource,
  ): void {
    const status = this.#symbols.SQLBindCol(
      stmtHandle,
      i,
      cType,
      buf,
      bufLen,
      indLenBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(
        `SQLBindCol failed: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            stmtHandle,
          )
        }\n`,
      );
    }
  }

  async fetch(
    stmtHandle: Deno.PointerValue,
  ): Promise<boolean> {
    const status = await this.#symbols.SQLFetch(
      stmtHandle,
    );

    if (status === SQLRETURN.SQL_NO_DATA) return false;

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(
        `SQLFetch failed: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            stmtHandle,
          )
        }\n`,
      );
    }

    return true;
  }

  async getData(
    stmtHandle: Deno.PointerValue,
    colNumber: number,
    cType: CType,
    buf: BufferSource,
    bufLen: bigint,
    indLenBuf: BufferSource,
  ): ReturnType<OdbcSymbols["SQLGetData"]> {
    const status = await this.#symbols.SQLGetData(
      stmtHandle,
      colNumber,
      cType,
      buf,
      bufLen,
      indLenBuf,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO &&
      status !== SQLRETURN.SQL_NO_DATA
    ) {
      throw new Error(
        `SQLGetData failed: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_STMT,
            stmtHandle,
          )
        }`,
      );
    }

    return status;
  }

  async endTransaction(
    dbcHandle: Deno.PointerValue,
    completionType: TxCompletionType,
  ): Promise<void> {
    const status = await this.#symbols.SQLEndTran(
      HandleType.SQL_HANDLE_DBC,
      dbcHandle,
      completionType,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(
        `SQLEndTran failed: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_DBC,
            dbcHandle,
          )
        }\n`,
      );
    }
  }

  setConnectAttr(
    handle: Deno.PointerValue,
    attribute: number,
    valuePtr: Deno.PointerValue,
    stringLength: number = SQL_IS_INTEGER,
  ) {
    const status = this.#symbols.SQLSetConnectAttrW(
      handle,
      attribute,
      valuePtr,
      stringLength,
    );

    if (
      status !== SQLRETURN.SQL_SUCCESS &&
      status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
    ) {
      throw new Error(
        `SQLSetConnectAttrW Error: ${
          this.getOdbcError(
            HandleType.SQL_HANDLE_DBC,
            handle,
          )
        }`,
      );
    }
  }

  close() {
    this.#dylib.close();
  }
}

interface OdbcSymbols {
  /**
   * `SQLAllocHandle` allocates an environment, connection, statement, or descriptor handle.
   *
   * ```cpp
   * SQLRETURN SQLAllocHandle(
   *       SQLSMALLINT   HandleType,
   *       SQLHANDLE     InputHandle,
   *       SQLHANDLE *   OutputHandlePtr)
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlallochandle-function?view=sql-server-ver17}
   */
  SQLAllocHandle(
    handleType: HandleType,
    inputHandle: Deno.PointerValue,
    outputHandlePtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_INVALID_HANDLE
    | SQLRETURN.SQL_ERROR;

  /**
   * `SQLFreeHandle` frees resources associated with a specific environment, connection, statement, or descriptor handle.
   *
   * ```cpp
   * SQLRETURN SQLFreeHandle(
   *      SQLSMALLINT   HandleType,
   *      SQLHANDLE     Handle);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlfreehandle-function?view=sql-server-ver17}
   */
  SQLFreeHandle(
    handleType: number,
    handle: Deno.PointerValue,
  ): SQLRETURN.SQL_SUCCESS | SQLRETURN.SQL_ERROR | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLDriverConnectW` is an alternative to SQLConnect. It supports data sources that require more connection information than the three arguments in SQLConnect, dialog boxes to prompt the user for all connection information, and data sources that are not defined in the system information. For more information, see Connecting with SQLDriverConnect.
   *
   * ```cpp
   * SQLRETURN SQLDriverConnectW(
   *      SQLHDBC         ConnectionHandle,
   *      SQLHWND         WindowHandle,
   *      SQLWCHAR *      InConnectionString,
   *      SQLSMALLINT     StringLength1,
   *      SQLWCHAR *      OutConnectionString,
   *      SQLSMALLINT     BufferLength,
   *      SQLSMALLINT *   StringLength2Ptr,
   *      SQLUSMALLINT    DriverCompletion);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqldriverconnect-function?view=sql-server-ver17}
   */
  SQLDriverConnectW(
    connectionHandle: Deno.PointerValue,
    windowHandle: Deno.PointerValue,
    inConnectionString: BufferSource,
    stringLength1: number,
    outConnectionString: Deno.PointerValue,
    bufferLength: number,
    stringLength2Ptr: Deno.PointerValue,
    driverCompletion: number,
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
    | SQLRETURN.SQL_STILL_EXECUTING
  >;

  /**
   * `SQLDisconnect` closes the connection associated with a specific connection handle.
   *
   * ```cpp
   * SQLRETURN SQLDisconnect(
   *      SQLHDBC     ConnectionHandle);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqldisconnect-function?view=sql-server-ver17}
   */
  SQLDisconnect(
    connectionHandle: Deno.PointerValue,
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
    | SQLRETURN.SQL_STILL_EXECUTING
  >;

  /**
   * `SQLGetDiagRecW` returns the current values of multiple fields of a diagnostic record that contains error, warning, and status information. Unlike `SQLGetDiagField`, which returns one diagnostic field per call, `SQLGetDiagRec` returns several commonly used fields of a diagnostic record, including the `SQLSTATE`, the native error code, and the diagnostic message text.
   *
   * ```cpp
   * SQLRETURN SQLGetDiagRecW(
   *      SQLSMALLINT     HandleType,
   *      SQLHANDLE       Handle,
   *      SQLSMALLINT     RecNumber,
   *      SQLWCHAR *      SQLState,
   *      SQLINTEGER *    NativeErrorPtr,
   *      SQLWCHAR *      MessageText,
   *      SQLSMALLINT     BufferLength,
   *      SQLSMALLINT *   TextLengthPtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlgetdiagrec-function?view=sql-server-ver17}
   */
  SQLGetDiagRecW(
    handleType: HandleType,
    handle: Deno.PointerValue,
    recNumber: number,
    sqlState: BufferSource,
    nativeErrorPtr: BufferSource,
    messageText: BufferSource,
    bufferLength: number,
    textLengthPtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * SQLExecDirect executes a preparable statement, using the current values of the parameter marker variables if any parameters exist in the statement. SQLExecDirect is the fastest way to submit a SQL statement for one-time execution.
   *
   * ```cpp
   * SQLRETURN SQLExecDirectW(
   *      SQLHSTMT     StatementHandle,
   *      SQLWCHAR *   StatementText,
   *      SQLINTEGER   TextLength);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlexecdirect-function?view=sql-server-ver17}
   */
  SQLExecDirectW(
    statementHandle: Deno.PointerValue,
    statementText: BufferSource,
    textLength: number,
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_NEED_DATA
    | SQLRETURN.SQL_STILL_EXECUTING
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_INVALID_HANDLE
    | SQLRETURN.SQL_PARAM_DATA_AVAILABLE
  >;

  /**
   * `SQLRowCount` returns the number of rows affected by an `UPDATE`, `INSERT`, or `DELETE` statement; an `SQL_ADD`, `SQL_UPDATE_BY_BOOKMARK`, or `SQL_DELETE_BY_BOOKMARK` operation in `SQLBulkOperations`; or an `SQL_UPDATE` or `SQL_DELETE` operation in `SQLSetPos`.
   *
   * ```cpp
   * SQLRETURN SQLRowCount(
   *       SQLHSTMT   StatementHandle,
   *       SQLLEN *   RowCountPtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlrowcount-function?view=sql-server-ver17}
   */
  SQLRowCount(
    statementHandle: Deno.PointerValue,
    rowCountPtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLBindParameter` binds a buffer to a parameter marker in a SQL statement. `SQLBindParameter` supports binding to a Unicode C data type, even if the underlying driver does not support Unicode data.
   *
   * ```cpp
   * SQLRETURN SQLBindParameter(
   *       SQLHSTMT        StatementHandle,
   *       SQLUSMALLINT    ParameterNumber,
   *       SQLSMALLINT     InputOutputType,
   *       SQLSMALLINT     ValueType,
   *       SQLSMALLINT     ParameterType,
   *       SQLULEN         ColumnSize,
   *       SQLSMALLINT     DecimalDigits,
   *       SQLPOINTER      ParameterValuePtr,
   *       SQLLEN          BufferLength,
   *       SQLLEN *        StrLen_or_IndPtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlbindparameter-function?view=sql-server-ver17}
   */
  SQLBindParameter(
    statementHandle: Deno.PointerValue,
    parameterNumber: number,
    inputOutputType: number,
    valueType: CType,
    parameterType: SQLType,
    columnSize: bigint,
    decimalDigits: number,
    parameterValuePtr: BufferSource,
    bufferLength: bigint,
    StrLen_or_IndPtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLNumResultCols` returns the number of columns in a result set.
   *
   * ```cpp
   * SQLRETURN SQLNumResultCols(
   *      SQLHSTMT        StatementHandle,
   *      SQLSMALLINT *   ColumnCountPtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlnumresultcols-function?view=sql-server-ver17}
   */
  SQLNumResultCols(
    statementHandle: Deno.PointerValue,
    columnCountPtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_STILL_EXECUTING
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLDescribeColW` returns the result descriptor - column name,type, column size, decimal digits, and nullability - for one column in the result set. This information also is available in the fields of the IRD.
   *
   * ```cpp
   * SQLRETURN SQLDescribeColW(
   *       SQLHSTMT       StatementHandle,
   *       SQLUSMALLINT   ColumnNumber,
   *       SQLWCHAR *     ColumnName,
   *       SQLSMALLINT    BufferLength,
   *       SQLSMALLINT *  NameLengthPtr,
   *       SQLSMALLINT *  DataTypePtr,
   *       SQLULEN *      ColumnSizePtr,
   *       SQLSMALLINT *  DecimalDigitsPtr,
   *       SQLSMALLINT *  NullablePtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqldescribecol-function?view=sql-server-ver17}
   */
  SQLDescribeColW(
    statementHandle: Deno.PointerValue,
    columnNumber: number,
    columnName: BufferSource,
    bufferLength: number,
    nameLengthPtr: BufferSource,
    dataTypePtr: BufferSource,
    columnSizePtr: BufferSource,
    decimalDigitsPtr: BufferSource,
    nullablePtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_STILL_EXECUTING
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLBindCol` binds application data buffers to columns in the result set.
   *
   * ```cpp
   * SQLRETURN SQLBindCol(
   *       SQLHSTMT       StatementHandle,
   *       SQLUSMALLINT   ColumnNumber,
   *       SQLSMALLINT    TargetType,
   *       SQLPOINTER     TargetValuePtr,
   *       SQLLEN         BufferLength,
   *       SQLLEN *       StrLen_or_IndPtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlbindcol-function?view=sql-server-ver17}
   */
  SQLBindCol(
    statementHandle: Deno.PointerValue,
    columnNumber: number,
    targetType: number,
    targetValuePtr: BufferSource,
    bufferLength: bigint,
    strLen_or_IndPtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLFetch` fetches the next rowset of data from the result set and returns data for all bound columns.
   *
   * ```cpp
   * SQLRETURN SQLFetch(
   *      SQLHSTMT     StatementHandle);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlfetch-function?view=sql-server-ver17}
   */
  SQLFetch(statementHandle: Deno.PointerValue): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_STILL_EXECUTING
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
  >;

  /**
   * `SQLEndTran` requests a commit or rollback operation for all active operations on all statements associated with a connection. SQLEndTran can also request that a commit or rollback operation be performed for all connections associated with an environment.
   *
   * ```cpp
   * SQLRETURN SQLEndTran(
   *      SQLSMALLINT   HandleType,
   *      SQLHANDLE     Handle,
   *      SQLSMALLINT   CompletionType);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlendtran-function?view=sql-server-ver17}
   */
  SQLEndTran(
    handleType: HandleType,
    handle: Deno.PointerValue,
    completionType: TxCompletionType,
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
    | SQLRETURN.SQL_STILL_EXECUTING
  >;

  /**
   * `SQLSetConnectAttr` sets attributes that govern aspects of connections.
   *
   * ```cpp
   * SQLRETURN SQLSetConnectAttr(
   *      SQLHDBC       ConnectionHandle,
   *      SQLINTEGER    Attribute,
   *      SQLPOINTER    ValuePtr,
   *      SQLINTEGER    StringLength);
   *  ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlsetconnectattr-function?view=sql-server-ver17}
   */
  SQLSetConnectAttrW(
    connectionHandle: Deno.PointerValue,
    attribute: number,
    valuePtr: Deno.PointerValue,
    stringLength: number,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * `SQLGetData` retrieves data for a single column in the result set or for a single parameter after SQLParamData returns SQL_PARAM_DATA_AVAILABLE. It can be called multiple times to retrieve variable-length data in parts.
   *
   * ```cpp
   * SQLRETURN SQLGetData(
   *       SQLHSTMT       StatementHandle,
   *       SQLUSMALLINT   Col_or_Param_Num,
   *       SQLSMALLINT    TargetType,
   *       SQLPOINTER     TargetValuePtr,
   *       SQLLEN         BufferLength,
   *       SQLLEN *       StrLen_or_IndPtr);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlgetdata-function?view=sql-server-ver17}
   */
  SQLGetData(
    StatementHandle: Deno.PointerValue,
    col_or_Param_Num: number,
    targetType: CType,
    targetValuePtr: BufferSource,
    bufferLength: bigint,
    strLen_or_IndPtr: BufferSource,
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_STILL_EXECUTING
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
  >;

  /**
   * `SQLSetEnvAttr` sets attributes that govern aspects of environments.
   *
   * ```cpp
   * SQLRETURN SQLSetEnvAttr(
   *      SQLHENV      EnvironmentHandle,
   *      SQLINTEGER   Attribute,
   *      SQLPOINTER   ValuePtr,
   *      SQLINTEGER   StringLength);
   * ```
   *
   * @see {@link https://learn.microsoft.com/en-us/sql/odbc/reference/syntax/sqlsetenvattr-function?view=sql-server-ver17}
   */
  SQLSetEnvAttr(
    environmentHandle: Deno.PointerValue,
    attribute: number,
    valuePtr: Deno.PointerValue,
    stringLength: number,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;

  /**
   * ```cpp
   * SQLRETURN SQLGetInfo(
   *      SQLHDBC         ConnectionHandle,
   *      SQLUSMALLINT    InfoType,
   *      SQLPOINTER      InfoValuePtr,
   *      SQLSMALLINT     BufferLength,
   *      SQLSMALLINT *   StringLengthPtr);
   * ```
   */
  SQLGetInfoW(
    connectionHandle: Deno.PointerValue,
    infoType: number,
    infoValuePtr: BufferSource,
    bufferLength: number,
    stringLengthPtr: BufferSource,
  ):
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE;
}

const decoder = new TextDecoder("utf-16le");

/**
 * Encodes a JavaScript string into a Null-Terminated UTF-16LE buffer.
 *
 * @param str The JavaScript string to encode.
 * @returns A `Uint8Array` view of the underlying UTF-16 buffer. Note: Deno FFI requires `Uint8Array` for "buffer" parameters, even if the underlying data is 16-bit aligned.
 */
export function strToBuf(str: string): Uint8Array<ArrayBuffer> {
  // Create a 16-bit array (native C "unsigned short" array). +1 for the null terminator \0
  const buf = new Uint16Array(str.length + 1);
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i); // JS strings are already stored as UTF-16 sequences internally.
  }
  return new Uint8Array(buf.buffer);
}

/**
 * Decodes a UTF-16LE "Wide" string buffer from ODBC into a JavaScript string.
 *
 * @param buffer The raw buffer containing the Wide characters.
 * @param len The number of haracters to decode.
 * @returns The decoded JavaScript string.
 */
export function bufToStr(buffer: Uint16Array, len: number): string {
  return decoder.decode(buffer.subarray(0, len));
}
