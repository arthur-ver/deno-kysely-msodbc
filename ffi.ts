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
   * SQLAllocHandle allocates an environment, connection, statement, or descriptor handle.
   * 
   * ```cpp
   * SQLRETURN SQLAllocHandle(
   *       SQLSMALLINT   HandleType,
   *       SQLHANDLE     InputHandle,
   *       SQLHANDLE *   OutputHandlePtr)
   * ```
   * 
   * @param handleType The type of handle to be allocated by SQLAllocHandle.
   * @param inputHandle The input handle in whose context the new handle is to be allocated.
   * @param outputHandlePtr Pointer to a buffer in which to return the handle to the newly allocated data structure.
   * @returns status code.
   *
   
   */
  SQLAllocHandle(
    handleType: HandleType,
    inputHandle: Deno.PointerValue,
    outputHandlePtr: Deno.PointerValue
  ): Promise<SQLRETURN>;

  /**
   * Connects to a specific driver by using a connection string.
   */
  SQLDriverConnectW(
    hdbc: Deno.PointerValue,
    hwnd: Deno.PointerValue,
    szConnStrIn: Deno.PointerValue,
    cbConnStrIn: number,
    szConnStrOut: Deno.PointerValue,
    cbConnStrOutMax: number,
    pcbConnStrOut: Deno.PointerValue,
    fDriverCompletion: number
  ): Promise<number>;

  /**
   * Returns the current values of multiple fields of a diagnostic record.
   * This function is synchronous (blocking).
   */
  SQLGetDiagRecW(
    handleType: number,
    handle: Deno.PointerValue,
    recNumber: number,
    sqlState: Deno.PointerValue,
    nativeError: Deno.PointerValue,
    messageText: Deno.PointerValue,
    bufferLength: number,
    textLength: Deno.PointerValue
  ): number;

  SQLDisconnect(handle: Deno.PointerValue): Promise<number>;

  SQLFreeHandle(recNumber: number, handle: Deno.PointerValue): Promise<number>;

  SQLExecDirectW(
    handle1: Deno.PointerValue,
    handle2: Deno.PointerValue,
    recNumber: number
  ): Promise<number>;

  SQLRowCount(handle1: Deno.PointerValue, handle2: Deno.PointerValue): number;
}

const dylib = Deno.dlopen(libPath, {
  SQLAllocHandle: {
    parameters: ["i16", "pointer", "pointer"],
    result: "i16",
    nonblocking: true,
  },
  SQLDriverConnectW: {
    parameters: [
      "pointer",
      "pointer",
      "pointer",
      "i16",
      "pointer",
      "i16",
      "pointer",
      "u16",
    ],
    result: "i16",
    nonblocking: true,
  },
  SQLGetDiagRecW: {
    parameters: [
      "i16",
      "pointer",
      "i16",
      "pointer",
      "pointer",
      "pointer",
      "i16",
      "pointer",
    ],
    result: "i16",
  },
  SQLDisconnect: { parameters: ["pointer"], result: "i16", nonblocking: true },
  SQLFreeHandle: {
    parameters: ["i16", "pointer"],
    result: "i16",
    nonblocking: true,
  },
  SQLExecDirectW: {
    parameters: ["pointer", "pointer", "i32"],
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
  const outHandleBuffer = new BigUint64Array(1);

  const status = await odbcLib.SQLAllocHandle(
    handleType,
    parentHandle,
    Deno.UnsafePointer.of(outHandleBuffer)
  );

  if (
    status !== SQLRETURN.SQL_SUCCESS &&
    status !== SQLRETURN.SQL_SUCCESS_WITH_INFO
  ) {
    throw new Error(`SQLAllocHandle failed (Type: ${handleType})`);
  }

  const handleAddress = outHandleBuffer[0];
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
    Deno.UnsafePointer.of(connStrEncoded as any),
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
    const errorDetail = getOdbcError(HandleType.SQL_HANDLE_DBC, dbcHandle);
    throw new Error(`ODBC Connection Failed:\n${errorDetail}`);
  }
}

export async function execDirect(
  sql: string,
  stmtHandle: Deno.PointerValue
): Promise<void> {
  const sqlEncoded = strToUtf16(sql);
  const ret = await odbcLib.SQLExecDirectW(
    stmtHandle,
    Deno.UnsafePointer.of(sqlEncoded as any),
    SQL_NTS
  );

  if (
    ret !== SQLRETURN.SQL_SUCCESS &&
    ret !== SQLRETURN.SQL_SUCCESS_WITH_INFO &&
    ret !== SQLRETURN.SQL_NO_DATA
  ) {
    throw new Error(
      `Execution Error: ${getOdbcError(
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

export function getOdbcError(
  handleType: number,
  handle: Deno.PointerValue
): string {
  const errors: string[] = [];
  let i = 1;

  while (true) {
    const stateBuf = new Uint16Array(6);
    const nativeErrBuf = new Int32Array(1);
    const msgBuf = new Uint16Array(512);
    const msgLenBuf = new Int16Array(1);

    const ret = odbcLib.SQLGetDiagRecW(
      handleType,
      handle,
      i,
      Deno.UnsafePointer.of(stateBuf),
      Deno.UnsafePointer.of(nativeErrBuf),
      Deno.UnsafePointer.of(msgBuf),
      msgBuf.length,
      Deno.UnsafePointer.of(msgLenBuf)
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

export function strToUtf16(str: string): Uint8Array {
  const buf = new Uint16Array(str.length + 1);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  buf[str.length] = 0;
  return new Uint8Array(buf.buffer);
}
