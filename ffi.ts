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

export const SQL_DRIVER_NOPROMPT = 0;
export const SQL_NTS = -3;

export const SQL_C_CHAR = 1;
export const SQL_C_LONG = 4;
export const SQL_C_DOUBLE = 8;
export const SQL_C_WCHAR = -8;

export const SQL_INTEGER = 4;
export const SQL_WVARCHAR = -9;

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
    outputHandlePtr: BufferSource
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_INVALID_HANDLE
    | SQLRETURN.SQL_ERROR
  >;

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
    driverCompletion: number
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
    textLengthPtr: BufferSource
  ): Promise<
    | SQLRETURN.SQL_SUCCESS
    | SQLRETURN.SQL_SUCCESS_WITH_INFO
    | SQLRETURN.SQL_ERROR
    | SQLRETURN.SQL_NO_DATA
    | SQLRETURN.SQL_INVALID_HANDLE
  >;

  SQLDisconnect(handle: Deno.PointerValue): Promise<number>;

  SQLFreeHandle(recNumber: number, handle: Deno.PointerValue): Promise<number>;

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
    textLength: number
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

  SQLRowCount(handle1: Deno.PointerValue, handle2: Deno.PointerValue): number;
}

const dylib = Deno.dlopen(libPath, {
  SQLAllocHandle: {
    parameters: [
      "i16", // SQLSMALLINT <- in
      "pointer", // SQLHANDLE <- in
      "buffer", // SQLHANDLE * -> out
    ],
    result: "i16", // SQLRETURN: signed short int
    nonblocking: true,
  },
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
    result: "i16", // SQLRETURN: signed short int
    nonblocking: true,
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
    result: "i16", // SQLRETURN: signed short int
    nonblocking: true,
  },
  SQLDisconnect: { parameters: ["pointer"], result: "i16", nonblocking: true },
  SQLFreeHandle: {
    parameters: ["i16", "pointer"],
    result: "i16",
    nonblocking: true,
  },
  SQLExecDirectW: {
    parameters: ["pointer", "buffer", "i32"],
    result: "i16",
    nonblocking: true,
  },
  SQLRowCount: {
    parameters: ["pointer", "pointer"],
    result: "i16",
  },
});

export const odbcLib = dylib.symbols as OdbcSymbols;

/**
 * Allocates a new ODBC handle of the specified type.
 *
 * This wrapper simplifies `SQLAllocHandle` by automatically creating the required
 * output buffer, checking the status code for errors, and converting the resulting
 * memory address into a usable `Deno.PointerValue` object.
 *
 * @param handleType The type of handle to allocate (e.g., `SQL_HANDLE_ENV`, `SQL_HANDLE_DBC`).
 * @param parentHandle The parent context for the new handle. Pass `null` if allocating an Environment (`ENV`) handle.
 * @returns A promise that resolves to the newly allocated handle pointer.
 * @throws If the ODBC call returns a non-success status (e.g., `SQL_ERROR`) or if the driver returns a null pointer.
 */
export async function allocHandle(
  handleType: HandleType,
  parentHandle: Deno.PointerValue
): Promise<Deno.PointerValue> {
  const outHandleBuf = new BigUint64Array(1);

  const status = await odbcLib.SQLAllocHandle(
    handleType,
    parentHandle,
    outHandleBuf
  );

  if (
    status !== SQLRETURN.SQL_SUCCESS &&
    status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
  ) {
    throw new Error(`SQLAllocHandle failed (Type: ${handleType})`);
  }

  const handleAddress = outHandleBuf[0];
  if (handleAddress === 0n) {
    throw new Error(
      `SQLAllocHandle returned invalid (null) handle (Type: ${HandleType[handleType]})`
    );
  }

  return Deno.UnsafePointer.create(handleAddress);
}

export async function driverConnect(
  connectionString: string,
  dbcHandle: Deno.PointerValue
): Promise<void> {
  const connStrEncoded = strToUtf16(connectionString);
  const ret = await odbcLib.SQLDriverConnectW(
    dbcHandle,
    null,
    connStrEncoded,
    SQL_NTS,
    null,
    0,
    null,
    SQL_DRIVER_NOPROMPT
  );
  if (
    ret !== SQLRETURN.SQL_SUCCESS &&
    ret !== SQLRETURN.SQL_SUCCESS_WITH_INFO
  ) {
    const errorDetail = await getOdbcError(
      HandleType.SQL_HANDLE_DBC,
      dbcHandle
    );
    throw new Error(`ODBC Connection Failed:\n${errorDetail}`);
  }
}

export async function execDirect(
  sql: string,
  stmtHandle: Deno.PointerValue
): Promise<void> {
  const sqlEncoded = strToUtf16(sql);
  const ret = await odbcLib.SQLExecDirectW(stmtHandle, sqlEncoded, SQL_NTS);

  if (
    ret !== SQLRETURN.SQL_SUCCESS &&
    ret !== SQLRETURN.SQL_SUCCESS_WITH_INFO &&
    ret !== SQLRETURN.SQL_NO_DATA
  ) {
    throw new Error(
      `Execution Error: ${await getOdbcError(
        HandleType.SQL_HANDLE_STMT,
        stmtHandle
      )}\nSQL: ${sql}`
    );
  }
}

export async function rowCount(handle: Deno.PointerValue): Promise<number> {
  const rowCountBuf = new BigUint64Array(1);

  const ret = await odbcLib.SQLRowCount(
    handle,
    Deno.UnsafePointer.of(rowCountBuf)
  );

  if (
    ret !== SQLRETURN.SQL_SUCCESS &&
    ret !== SQLRETURN.SQL_SUCCESS_WITH_INFO
  ) {
    throw new Error(`SQLRowCount failed (${ret})`);
  }

  const rowCount = Number(rowCountBuf[0]);

  return rowCount;
}

export async function getOdbcError(
  handleType: HandleType,
  handle: Deno.PointerValue
): Promise<string> {
  const errors: string[] = [];
  let i = 1;

  while (true) {
    const stateBuf = new Uint16Array(6);
    const nativeErrBuf = new Int32Array(1);
    const msgBuf = new Uint16Array(512);
    const msgLenBuf = new Int16Array(1);

    const ret = await odbcLib.SQLGetDiagRecW(
      handleType,
      handle,
      i,
      stateBuf,
      nativeErrBuf,
      msgBuf,
      msgBuf.length,
      msgLenBuf
    );

    if (ret === SQLRETURN.SQL_NO_DATA) break;

    const decoder = new TextDecoder("utf-16le");
    const state = decoder.decode(stateBuf).slice(0, 5);
    const msg = decoder.decode(msgBuf.subarray(0, msgLenBuf[0]));

    errors.push(`[${state}] ${msg} (Code: ${nativeErrBuf[0]})`);
    i++;
  }

  return errors.length > 0 ? errors.join("\n") : "Unknown ODBC Error";
}

/**
 * Converts a standard JavaScript string into a raw block of memory that a C program can read.
 *
 * @param str
 */
export function strToUtf16(str: string): Uint8Array<ArrayBuffer> {
  // Create a 16-bit array (native C "unsigned short" array). +1 for the null terminator \0
  const buf = new Uint16Array(str.length + 1);
  // Copy codes directly (Fast & Native Endian). JavaScript strings are already stored as UTF-16 sequences internally.
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }
  // Return the byte view (required for Deno FFI)
  return new Uint8Array(buf.buffer);
}
