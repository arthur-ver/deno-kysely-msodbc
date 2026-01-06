export enum HandleType {
  SQL_HANDLE_ENV = 1,
  SQL_HANDLE_DBC = 2,
  SQL_HANDLE_STMT = 3,
}

export enum SQLRETURN {
  SQL_SUCCESS = 0,
  SQL_SUCCESS_WITH_INFO = 1,
  SQL_ERROR = -1,
  SQL_INVALID_HANDLE = -2,
  SQL_NO_DATA = 100,
  SQL_STILL_EXECUTING = 2,
  SQL_NEED_DATA = 99,
  SQL_PARAM_DATA_AVAILABLE = 101,
}

export enum ValueType {
  SQL_C_SLONG = -16,
  SQL_C_SBIGINT = -25,
  SQL_C_DOUBLE = 8,
  SQL_C_BIT = -7,
  SQL_C_TYPE_TIMESTAMP = 11,
  SQL_C_BINARY = -2,
  SQL_C_WCHAR = -8,
  DUMMY = 1,
}

export enum ParameterType {
  SQL_CHAR = 1,
  SQL_INTEGER = 4,
  SQL_BIGINT = -5,
  SQL_FLOAT = 6,
  SQL_BIT = ValueType.SQL_C_BIT,
  SQL_VARBINARY = -3,
  SQL_VARCHAR = 12,
  SQL_LONGVARCHAR = -1,
  SQL_TYPE_DATE = 91,
  SQL_TYPE_TIMESTAMP = 93,
  // found in sqlucode.h
  SQL_WCHAR = -8,
  SQL_WVARCHAR = -9,
  SQL_WLONGVARCHAR = -10,
}

export const SQL_PARAM_INPUT = 1;
export const SQL_NULL_DATA = -1;

export const SQL_DRIVER_NOPROMPT = 0;
export const SQL_NTS = -3;

let libPath: string;

switch (Deno.build.os) {
  case "darwin":
    libPath = "/opt/homebrew/lib/libmsodbcsql.18.dylib";
    break;
  case "linux":
    libPath = "/opt/microsoft/msodbcsql18/lib64/";
    break;
  case "windows":
    libPath = "C:\\Windows\\System32\\msodbcsql18.dll";
    break;
  default:
    throw new Error(`Unsupported OS: ${Deno.build.os}`);
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
   * @param handleType The type of handle to be allocated by SQLAllocHandle.
   * @param inputHandle The input handle in whose context the new handle is to be allocated. If HandleType is `SQL_HANDLE_ENV`, this is `SQL_NULL_HANDLE`. If HandleType is `SQL_HANDLE_DBC`, this must be an environment handle, and if it is `SQL_HANDLE_STMT` or `SQL_HANDLE_DESC`, it must be a connection handle.
   * @param outputHandlePtr Pointer to a buffer in which to return the handle to the newly allocated data structure.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_INVALID_HANDLE`, or `SQL_ERROR`.
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
   * @param connectionHandle Connection handle.
   * @param windowHandle Window handle. The application can pass the handle of the parent window, if applicable, or a null pointer if either the window handle is not applicable or SQLDriverConnect will not present any dialog boxes.
   * @param inConnectionString A full connection string (see the syntax in "Comments"), a partial connection string, or an empty string.
   * @param stringLength1 Length of *InConnectionString, in characters if the string is Unicode, or bytes if string is ANSI or DBCS.
   * @param outConnectionString Pointer to a buffer for the completed connection string. Upon successful connection to the target data source, this buffer contains the completed connection string. Applications should allocate at least 1,024 characters for this buffer. If OutConnectionString is NULL, StringLength2Ptr will still return the total number of characters (excluding the null-termination character for character data) available to return in the buffer pointed to by OutConnectionString.
   * @param bufferLength Length of the *OutConnectionString buffer, in characters.
   * @param stringLength2Ptr Pointer to a buffer in which to return the total number of characters (excluding the null-termination character) available to return in *OutConnectionString. If the number of characters available to return is greater than or equal to BufferLength, the completed connection string in *OutConnectionString is truncated to BufferLength minus the length of a null-termination character.
   * @param driverCompletion Flag that indicates whether the Driver Manager or driver must prompt for more connection information: `SQL_DRIVER_PROMPT`, `SQL_DRIVER_COMPLETE`, `SQL_DRIVER_COMPLETE_REQUIRED`, or `SQL_DRIVER_NOPROMPT`.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_NO_DATA`, `SQL_ERROR`, `SQL_INVALID_HANDLE`, or `SQL_STILL_EXECUTING`.
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
   * @param handleType A handle type identifier that describes the type of handle for which diagnostics are required. Must be one of the following: `SQL_HANDLE_DBC`, `SQL_HANDLE_DESC`, `SQL_HANDLE_ENV`, `SQL_HANDLE_STMT`
   * @param handle A handle for the diagnostic data structure, of the type indicated by `HandleType`. If `HandleType` is `SQL_HANDLE_ENV`, Handle can be either a shared or an unshared environment handle.
   * @param recNumber Indicates the status record from which the application seeks information. Status records are numbered from 1.
   * @param sqlState Pointer to a buffer in which to return a five-character `SQLSTATE` code (and terminating `NULL`) for the diagnostic record `RecNumber`. The first two characters indicate the class; the next three indicate the subclass. This information is contained in the `SQL_DIAG_SQLSTATE` diagnostic field. For more information, see `SQLSTATEs`.
   * @param nativeErrorPtr Pointer to a buffer in which to return the native error code, specific to the data source. This information is contained in the `SQL_DIAG_NATIVE` diagnostic field.
   * @param messageText Pointer to a buffer in which to return the diagnostic message text string. This information is contained in the `SQL_DIAG_MESSAGE_TEXT` diagnostic field. For the format of the string, see Diagnostic Messages. If MessageText is `NULL`, `TextLengthPtr` will still return the total number of characters (excluding the null-termination character for character data) available to return in the buffer pointed to by `MessageText`.
   * @param bufferLength Length of the `*MessageText` buffer in characters. There is no maximum length of the diagnostic message text.
   * @param textLengthPtr Pointer to a buffer in which to return the total number of characters (excluding the number of characters required for the null-termination character) available to return in `*MessageText`. If the number of characters available to return is greater than `BufferLength`, the diagnostic message text in `*MessageText` is truncated to `BufferLength` minus the length of a null-termination character.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_ERROR`, `SQL_NO_DATA`, or `SQL_INVALID_HANDLE`.
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
   * `SQLDisconnect` closes the connection associated with a specific connection handle.
   *
   * ```cpp
   * SQLRETURN SQLDisconnect(
   *      SQLHDBC     ConnectionHandle);
   * ```
   *
   * @param handle Connection handle.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_ERROR`, `SQL_INVALID_HANDLE`, or `SQL_STILL_EXECUTING`.
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
   * `SQLFreeHandle` frees resources associated with a specific environment, connection, statement, or descriptor handle.
   *
   * ```cpp
   * SQLRETURN SQLFreeHandle(
   *      SQLSMALLINT   HandleType,
   *      SQLHANDLE     Handle);
   * ```
   *
   * @param handleType The type of handle to be freed by `SQLFreeHandle`. Must be one of the following values: `SQL_HANDLE_DBC`, `SQL_HANDLE_DESC`, `SQL_HANDLE_ENV`, `SQL_HANDLE_STMT`.
   * @param handle The handle to be freed.
   * @returns `SQL_SUCCESS`, `SQL_ERROR`, or `SQL_INVALID_HANDLE`.
   */
  SQLFreeHandle(
    handleType: number,
    handle: Deno.PointerValue,
  ): SQLRETURN.SQL_SUCCESS | SQLRETURN.SQL_ERROR | SQLRETURN.SQL_INVALID_HANDLE;

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
   * @param statementHandle Statement handle.
   * @param statementText SQL statement to be executed.
   * @param textLength Length of *StatementText in characters.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_NEED_DATA`, `SQL_STILL_EXECUTING`, `SQL_ERROR`, `SQL_NO_DATA`, `SQL_INVALID_HANDLE`, or `SQL_PARAM_DATA_AVAILABLE`.
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
   * @param statementHandle Statement handle.
   * @param rowCountPtr Points to a buffer in which to return a row count. For `UPDATE`, `INSERT`, and `DELETE` statements, for the `SQL_ADD`, `SQL_UPDATE_BY_BOOKMARK`, and `SQL_DELETE_BY_BOOKMARK` operations in `SQLBulkOperations`, and for the `SQL_UPDATE` or `SQL_DELETE` operations in `SQLSetPos`, the value returned in `*RowCountPtr` is either the number of rows affected by the request or `-1` if the number of affected rows is not available.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_ERROR`, or `SQL_INVALID_HANDLE`.
   */
  SQLRowCount(
    statementHandle: Deno.PointerValue,
    rowCountPtr: BufferSource,
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
  >;

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
   * @param statementHandle Statement handle.
   * @param parameterNumber Parameter number, ordered sequentially in increasing parameter order, starting at 1.
   * @param inputOutputType The type of the parameter.
   * @param valueType The C data type of the parameter.
   * @param parameterType The SQL data type of the parameter.
   * @param columnSize The size of the column or expression of the corresponding parameter marker.
   * @param decimalDigits The decimal digits of the column or expression of the corresponding parameter marker.
   * @param parameterValuePtr A pointer to a buffer for the parameter's data.
   * @param bufferLength Length of the ParameterValuePtr buffer in bytes.
   * @param StrLen_or_IndPtr A pointer to a buffer for the parameter's length.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_ERROR`, or `SQL_INVALID_HANDLE`.
   */
  SQLBindParameter(
    statementHandle: Deno.PointerValue,
    parameterNumber: number,
    inputOutputType: number,
    valueType: ValueType,
    parameterType: ParameterType,
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
   * @param statementHandle Statement handle.
   * @param columnCountPtr Pointer to a buffer in which to return the number of columns in the result set. This count does not include a bound bookmark column.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_STILL_EXECUTING`, `SQL_ERROR`, or `SQL_INVALID_HANDLE`.
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
   * @param statementHandle Statement handle.
   * @param columnNumber Column number of result data, ordered sequentially in increasing column order, starting at 1. The ColumnNumber argument can also be set to 0 to describe the bookmark column.
   * @param columnName Pointer to a null-terminated buffer in which to return the column name. This value is read from the SQL_DESC_NAME field of the IRD. If the column is unnamed or the column name cannot be determined, the driver returns an empty string. If ColumnName is NULL, NameLengthPtr will still return the total number of characters (excluding the null-termination character for character data) available to return in the buffer pointed to by ColumnName.
   * @param bufferLength Length of the *ColumnName buffer, in characters.
   * @param nameLengthPtr Pointer to a buffer in which to return the total number of characters (excluding the null termination) available to return in *ColumnName. If the number of characters available to return is greater than or equal to BufferLength, the column name in *ColumnName is truncated to BufferLength minus the length of a null-termination character.
   * @param dataTypePtr Pointer to a buffer in which to return the SQL data type of the column. This value is read from the SQL_DESC_CONCISE_TYPE field of the IRD. This will be one of the values in SQL Data Types, or a driver-specific SQL data type. If the data type cannot be determined, the driver returns SQL_UNKNOWN_TYPE. In ODBC 3.x, SQL_TYPE_DATE, SQL_TYPE_TIME, or SQL_TYPE_TIMESTAMP is returned in *DataTypePtr for date, time, or timestamp data, respectively; in ODBC 2.x, SQL_DATE, SQL_TIME, or SQL_TIMESTAMP is returned. The Driver Manager performs the required mappings when an ODBC 2.x application is working with an ODBC 3.x driver or when an ODBC 3.x application is working with an ODBC 2.x driver. When ColumnNumber is equal to 0 (for a bookmark column), SQL_BINARY is returned in *DataTypePtr for variable-length bookmarks. (SQL_INTEGER is returned if bookmarks are used by an ODBC 3.x application working with an ODBC 2.x driver or by an ODBC 2.x application working with an ODBC 3.x driver.)
   * @param columnSizePtr Pointer to a buffer in which to return the size (in characters) of the column on the data source. If the column size cannot be determined, the driver returns 0. For more information on column size, see Column Size, Decimal Digits, Transfer Octet Length, and Display Size in Appendix D: Data Types.
   * @param decimalDigitsPtr Pointer to a buffer in which to return the number of decimal digits of the column on the data source. If the number of decimal digits cannot be determined or is not applicable, the driver returns 0. For more information on decimal digits, see Column Size, Decimal Digits, Transfer Octet Length, and Display Size in Appendix D: Data Types.
   * @param nullablePtr Pointer to a buffer in which to return a value that indicates whether the column allows NULL values. This value is read from the SQL_DESC_NULLABLE field of the IRD. The value is one of the following: SQL_NO_NULLS, SQL_NULLABLE, SQL_NULLABLE_UNKNOWN
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_STILL_EXECUTING`, `SQL_ERROR`, or `SQL_INVALID_HANDLE`.
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
   * @param statementHandle Statement handle.
   * @param columnNumber Number of the result set column to bind. Columns are numbered in increasing column order starting at 0, where column 0 is the bookmark column. If bookmarks are not used - that is, the SQL_ATTR_USE_BOOKMARKS statement attribute is set to SQL_UB_OFF - then column numbers start at 1.
   * @param targetType The identifier of the C data type of the *TargetValuePtr buffer. When it is retrieving data from the data source with SQLFetch, SQLFetchScroll, SQLBulkOperations, or SQLSetPos, the driver converts the data to this type; when it sends data to the data source with SQLBulkOperations or SQLSetPos, the driver converts the data from this type. For a list of valid C data types and type identifiers, see the C Data Types section in Appendix D: Data Types.
   * @param targetValuePtr Pointer to the data buffer to bind to the column. SQLFetch and SQLFetchScroll return data in this buffer. SQLBulkOperations returns data in this buffer when Operation is SQL_FETCH_BY_BOOKMARK; it retrieves data from this buffer when Operation is SQL_ADD or SQL_UPDATE_BY_BOOKMARK. SQLSetPos returns data in this buffer when Operation is SQL_REFRESH; it retrieves data from this buffer when Operation is SQL_UPDATE.
   * @param bufferLength Length of the *TargetValuePtr buffer in bytes.
   * @param strLen_or_IndPtr Pointer to the length/indicator buffer to bind to the column. SQLFetch and SQLFetchScroll return a value in this buffer. SQLBulkOperations retrieves a value from this buffer when Operation is SQL_ADD, SQL_UPDATE_BY_BOOKMARK, or SQL_DELETE_BY_BOOKMARK. SQLBulkOperations returns a value in this buffer when Operation is SQL_FETCH_BY_BOOKMARK. SQLSetPos returns a value in this buffer when Operation is SQL_REFRESH; it retrieves a value from this buffer when Operation is SQL_UPDATE.
   * @returns `SQL_SUCCESS`, `SQL_SUCCESS_WITH_INFO`, `SQL_ERROR`, or `SQL_INVALID_HANDLE`.
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
   * @param statementHandle Statement handle.
   */
  SQLFetch(statementHandle: Deno.PointerValue): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_STILL_EXECUTING
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_INVALID_HANDLE
  >;
}

const dylib = Deno.dlopen(libPath, {
  // --- ASYNC (I/O BOUND) ---
  SQLDriverConnectW: {
    parameters: [
      "pointer", // SQLHDBC <- in
      "pointer", // SQLHWND <- in
      "buffer", // SQLWCHAR * <- in
      "i16", // SQLSMALLINT -> out
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
      "i32", // SQLINTEGER -> out
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
    nonblocking: true,
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
});

export const odbcLib = dylib.symbols as OdbcSymbols;

const decoder = new TextDecoder("utf-16le");

/**
 * Allocates a new ODBC handle of the specified type.
 *
 * This wrapper simplifies `SQLAllocHandle` by automatically creating the required
 * output buffer, checking the status code for errors, and converting the resulting
 * memory address into a usable `Deno.PointerValue` object.
 *
 * @param handleType The type of handle to allocate (e.g., `SQL_HANDLE_ENV`, `SQL_HANDLE_DBC`).
 * @param parentHandle The parent context for the new handle. Pass `null` if allocating an Environment (`ENV`) handle.
 * @returns Newly allocated handle pointer.
 * @throws If the ODBC call returns a non-success status (e.g., `SQL_ERROR`) or if the driver returns a null pointer.
 */
export function allocHandle(
  handleType: HandleType,
  parentHandle: Deno.PointerValue,
): Deno.PointerValue {
  const outHandleBuf = new BigUint64Array(1);

  const status = odbcLib.SQLAllocHandle(
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

/**
 * Establishes a connection to a driver and a data source using a connection string.
 *
 * This function wraps `SQLDriverConnectW`. It uses `SQL_DRIVER_NOPROMPT`, meaning
 * the connection string must contain all necessary information (DSN, User, Password, etc.)
 * to connect without user interaction. If the string is insufficient, the connection
 * will fail rather than prompting the user with a dialog.
 *
 * @param connStr The full connection string (e.g., `"driver={ODBC Driver 18 for SQL Server};server=127.0.0.1;uid=sa;pwd=Test123$;encrypt=yes;trustServerCertificate=yes;"`.
 * @param dbcHandle A valid Connection Handle allocated via `SQLAllocHandle`.
 * @throws If the connection fails. The error message will contain the specific SQL state and diagnostic message retrieved from the driver.
 * @returns Resolves when the connection is successfully established.
 */
export async function driverConnect(
  connStr: string,
  dbcHandle: Deno.PointerValue,
): Promise<void> {
  const connStrEncoded = strToBuf(connStr);

  const ret = await odbcLib.SQLDriverConnectW(
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
    ret !== SQLRETURN.SQL_SUCCESS &&
    ret !== SQLRETURN.SQL_SUCCESS_WITH_INFO
  ) {
    const errorDetail = getOdbcError(
      HandleType.SQL_HANDLE_DBC,
      dbcHandle,
    );
    throw new Error(`ODBC Connection Failed:\n${errorDetail}`);
  }
}

/**
 * Executes a SQL statement directly without prior preparation.
 *
 * This function wraps `SQLExecDirectW`. It is the fastest way to execute a statement once.
 *
 * @param rawSql The SQL statement to execute.
 * @param stmtHandle A valid Statement Handle.
 * @throws If execution fails. The error includes the specific ODBC diagnostic message and the SQL that caused the failure.
 * @returns Resolves to number of columns in the result set
 */
export async function execDirect(
  rawSql: string,
  stmtHandle: Deno.PointerValue,
): Promise<number> {
  const rawSqlEncoded = strToBuf(rawSql);
  const ret = await odbcLib.SQLExecDirectW(stmtHandle, rawSqlEncoded, SQL_NTS);

  if (
    ret !== SQLRETURN.SQL_SUCCESS &&
    ret !== SQLRETURN.SQL_SUCCESS_WITH_INFO &&
    ret !== SQLRETURN.SQL_NO_DATA
  ) {
    throw new Error(
      `Execution Error: ${
        getOdbcError(
          HandleType.SQL_HANDLE_STMT,
          stmtHandle,
        )
      }\nSQL: ${rawSql}`,
    );
  }

  const colCount = numResultCols(stmtHandle);
  return colCount;
}

/**
 * Returns the number of rows affected by an `UPDATE`, `INSERT`, or `DELETE` statement.
 *
 * @param stmtHandle The statement handle (HSTMT) on which the operation was performed.
 * @returns The count of affected rows.
 * @throws If the API call fails.
 */
export async function rowCount(stmtHandle: Deno.PointerValue): Promise<bigint> {
  const rowCountBuf = new BigUint64Array(1);

  const status = await odbcLib.SQLRowCount(
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

/**
 * Retrieves all diagnostic records (errors and warnings) associated with a specific handle.
 *
 * This function loops through available diagnostic records (`SQLGetDiagRecW`) until `SQL_NO_DATA` is returned. It captures the SQL State, Native Error Code, and the human-readable Message Text for each record.
 *
 * @param handleType The type of handle (e.g., `SQL_HANDLE_ENV`, `SQL_HANDLE_DBC`, `SQL_HANDLE_STMT`).
 * @param handle The pointer to the handle to inspect.
 * @returns A single string containing all error messages joined by newlines. Returns `"Unknown ODBC Error"` if no records are found.
 */
export function getOdbcError(
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

    const status = odbcLib.SQLGetDiagRecW(
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

/**
 * Wrapper for `SQLBindParameter` that binds a buffer to a parameter marker in the SQL statement.
 *
 * @param stmtHandle Statement handle.
 * @param i The parameter index number (ordered sequentially starting at 1).
 * @param cType The C data type identifier (e.g., `SQL_C_SLONG`, `SQL_C_WCHAR`) describing the format of `buf`.
 * @param sqlType The SQL data type identifier (e.g., `SQL_INTEGER`, `SQL_WVARCHAR`) describing the destination column.
 * @param columnSize The precision or column size of the corresponding parameter marker. **Ignored for fixed-width types like Integer/Float; required for Strings/Decimals**.
 * @param decimalDigits The decimal digits (scale) of the corresponding parameter marker.
 * @param buf The buffer containing the actual parameter data.
 * @param bufLen The length of the `buf` buffer in bytes.
 * @param indLenBuf A pointer to a buffer (usually `BigInt64Array`) containing the data length or null indicator.
 * @returns Resolves if binding is successful.
 * @throws Throws a detailed ODBC error message if `SQLBindParameter` fails.
 */
export function bindParameter(
  stmtHandle: Deno.PointerValue,
  i: number,
  cType: ValueType,
  sqlType: ParameterType,
  columnSize: bigint,
  decimalDigits: number,
  buf: BufferSource,
  bufLen: bigint,
  indLenBuf: BufferSource,
): void {
  const status = odbcLib.SQLBindParameter(
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
        getOdbcError(
          HandleType.SQL_HANDLE_STMT,
          stmtHandle,
        )
      }\n`,
    );
  }
}

/**
 * Wrapper for `SQLNumResultCols` that returns the number of columns in the result set for a prepared or executed statement.
 *
 * @param stmtHandle The handle to the statement.
 * @returns A promise that resolves to the number of columns in the result set.
 * @throws If the ODBC function call fails
 */
export function numResultCols(
  stmtHandle: Deno.PointerValue,
): number {
  const colCountBuf = new Int16Array(1);

  const status = odbcLib.SQLNumResultCols(
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

export function describeCol(
  stmtHandle: Deno.PointerValue,
  colNumber: number,
) {
  const CHAR_LIMIT = 256;

  const nameBuf = new Uint16Array(CHAR_LIMIT);
  const nameLenIndBuf = new Int16Array(1);
  const dataTypeBuf = new Int16Array(1);
  const columnSizeBuf = new BigUint64Array(1);
  const decimalDigitsBuf = new Int16Array(1);
  const nullableBuf = new Int16Array(1);

  const status = odbcLib.SQLDescribeColW(
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
        getOdbcError(
          HandleType.SQL_HANDLE_STMT,
          stmtHandle,
        )
      }\n`,
    );
  }

  const name = bufToStr(nameBuf, nameLenIndBuf[0]);

  return {
    name,
    dataType: dataTypeBuf[0],
    columnSize: columnSizeBuf[0],
    decimalDigits: decimalDigitsBuf[0],
    isNullable: nullableBuf[0] === 1,
  };
}

export function bindCol(
  stmtHandle: Deno.PointerValue,
  i: number,
  cType: ValueType,
  buf: BufferSource,
  bufLen: bigint,
  indLenBuf: BufferSource,
): void {
  const status = odbcLib.SQLBindCol(
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
        getOdbcError(
          HandleType.SQL_HANDLE_STMT,
          stmtHandle,
        )
      }\n`,
    );
  }
}

export async function fetch(
  stmtHandle: Deno.PointerValue,
): ReturnType<OdbcSymbols["SQLFetch"]> {
  const status = await odbcLib.SQLFetch(
    stmtHandle,
  );

  if (status === SQLRETURN.SQL_ERROR) {
    throw new Error(`SQLFetch failed: ${
      getOdbcError(
        HandleType.SQL_HANDLE_STMT,
        stmtHandle,
      )
    }`);
  }

  return status;
}

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
