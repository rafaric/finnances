export interface PaginatedResponseDTO<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

export function toPaginatedDTO<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResponseDTO<T> {
  return { items, page, limit, total, hasNextPage: page * limit < total };
}
