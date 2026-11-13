/**
 * Standardized API Envelopes for Express Backend & Next.js RTK Query Frontend
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  nextCursor?: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  executionTimeMs: number;
  cacheHit?: boolean;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}
