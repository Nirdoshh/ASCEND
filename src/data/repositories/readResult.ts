/** Distinguishes missing source records from unreadable history. */
export type RepositoryReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: 'storage-unavailable' | 'invalid-data' | 'newer-schema' }
