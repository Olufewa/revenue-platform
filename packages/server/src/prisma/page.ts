/** One cursor-paged slice of a list endpoint. */
export type Page<T> = { items: T[]; nextCursor: string | null };
