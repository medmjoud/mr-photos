import { setResponseStatus } from '@tanstack/react-start/server'

/** Error with a stable code that the UI translates (errors.<code>). */
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code)
  }
}

/** Sets the HTTP status and throws a coded error. Use only inside server handlers. */
export function fail(code: string, status = 400): never {
  setResponseStatus(status)
  throw new AppError(code, status)
}
