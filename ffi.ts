export const SQL_HANDLE_ENV = 1;
export const SQL_HANDLE_DBC = 2;
export const SQL_HANDLE_STMT = 3;
export const SQL_SUCCESS = 0;
export const SQL_SUCCESS_WITH_INFO = 1;
export const SQL_ERROR = -1;
export const SQL_NO_DATA = 100;
export const SQL_DRIVER_NOPROMPT = 0;
export const SQL_NTS = -3;

export const SQL_C_CHAR = 1;
export const SQL_C_LONG = 4;
export const SQL_C_DOUBLE = 8;
export const SQL_C_WCHAR = -8;

export const SQL_INTEGER = 4;
export const SQL_WVARCHAR = -9;

export const odbcLib = Deno.dlopen("/opt/homebrew/lib/libmsodbcsql.18.dylib", {
  SQLAllocHandle: { parameters: ["i16", "pointer", "pointer"], result: "i16" },
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
  SQLDisconnect: { parameters: ["pointer"], result: "i16" },
  SQLFreeHandle: { parameters: ["i16", "pointer"], result: "i16" },
  SQLExecDirectW: { parameters: ["pointer", "pointer", "i32"], result: "i16" },
});

export function allocHandle(
  handleType: number,
  parentHandle: Deno.PointerValue
): Deno.PointerValue {
  const handleBuf = new BigUint64Array(1);

  const ret = odbcLib.symbols.SQLAllocHandle(
    handleType,
    parentHandle,
    Deno.UnsafePointer.of(handleBuf)
  );

  if (ret !== SQL_SUCCESS && ret !== SQL_SUCCESS_WITH_INFO) {
    throw new Error(`SQLAllocHandle failed (Type: ${handleType})`);
  }

  const rawHandle = handleBuf[0];
  if (rawHandle === 0n) {
    throw new Error(
      `SQLAllocHandle returned invalid (null) handle (Type: ${handleType})`
    );
  }

  return Deno.UnsafePointer.create(rawHandle);
}

export function sqlDriverConnect(
  connectionString: string,
  dbcHandle: Deno.PointerValue
) {
  const connStrEncoded = strToUtf16(connectionString);
  const ret = odbcLib.symbols.SQLDriverConnectW(
    dbcHandle,
    null,
    Deno.UnsafePointer.of(connStrEncoded as any),
    SQL_NTS,
    null,
    0,
    null,
    SQL_DRIVER_NOPROMPT
  );
  if (ret !== SQL_SUCCESS && ret !== SQL_SUCCESS_WITH_INFO) {
    const errorDetail = getOdbcError(SQL_HANDLE_DBC, dbcHandle);
    throw new Error(`ODBC Connection Failed:\n${errorDetail}`);
  }
}

export function sqlExecDirect(sql: string, stmtHandle: Deno.PointerValue) {
  const sqlEncoded = strToUtf16(sql);
  const ret = odbcLib.symbols.SQLExecDirectW(
    stmtHandle,
    Deno.UnsafePointer.of(sqlEncoded as any),
    SQL_NTS
  );

  if (
    ret !== SQL_SUCCESS &&
    ret !== SQL_SUCCESS_WITH_INFO &&
    ret !== SQL_NO_DATA
  ) {
    throw new Error(
      `Execution Error: ${getOdbcError(
        SQL_HANDLE_STMT,
        stmtHandle
      )}\nSQL: ${sql}`
    );
  }
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

    const ret = odbcLib.symbols.SQLGetDiagRecW(
      handleType,
      handle,
      i,
      Deno.UnsafePointer.of(stateBuf),
      Deno.UnsafePointer.of(nativeErrBuf),
      Deno.UnsafePointer.of(msgBuf),
      msgBuf.length,
      Deno.UnsafePointer.of(msgLenBuf)
    );

    if (ret === SQL_NO_DATA) break;

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
