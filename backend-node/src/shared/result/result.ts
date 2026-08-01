export type OkResult<T> = { readonly ok: true; readonly value: T };
export type ErrResult<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = string> = OkResult<T> | ErrResult<E>;

export function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

export function err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Result unwrap failed');
  }
  return result.value;
}