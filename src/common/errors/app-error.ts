import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable application error codes for clients and logs.
 * HTTP status remains the primary wire contract.
 */
export enum AppErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppHttpException extends HttpException {
  readonly code: AppErrorCode;

  constructor(
    code: AppErrorCode,
    message: string | string[],
    status: HttpStatus,
  ) {
    super(
      {
        message,
        error: HttpStatus[status] ?? 'Error',
        statusCode: status,
        code,
      },
      status,
    );
    this.code = code;
  }
}

export function statusToAppErrorCode(status: number): AppErrorCode {
  switch (status) {
    case 400:
    case 422:
      return AppErrorCode.VALIDATION_FAILED;
    case 401:
      return AppErrorCode.UNAUTHORIZED;
    case 403:
      return AppErrorCode.FORBIDDEN;
    case 404:
      return AppErrorCode.NOT_FOUND;
    case 409:
      return AppErrorCode.CONFLICT;
    case 429:
      return AppErrorCode.RATE_LIMITED;
    case 502:
    case 503:
    case 504:
      return AppErrorCode.UPSTREAM_ERROR;
    default:
      return status >= 500
        ? AppErrorCode.INTERNAL_ERROR
        : AppErrorCode.INTERNAL_ERROR;
  }
}
