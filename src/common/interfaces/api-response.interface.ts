export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  path: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  /** Stable application error code for clients */
  code?: string;
  timestamp: string;
  path: string;
  requestId?: string;
}
