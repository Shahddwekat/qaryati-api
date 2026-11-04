import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { getRequestId } from '../middleware/request-id.middleware';

/** The body of every error response (see docs/architecture/error-model.md). */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

// Prisma errors that reach this filter were not handled by a service.
// Map the ones caused by the request to a 4xx code; everything else is a 500.
const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2000: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A value is too long for its field',
  },
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'A record with these values already exists',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    message: 'This change conflicts with a related record',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
};

function prismaCode(exception: unknown): string | undefined {
  const code = (exception as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined;
}

/** Turns any thrown value into a status code and a safe message. */
export function toHttpError(exception: unknown): {
  status: number;
  message: string | string[];
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : ((response as { message?: string | string[] }).message ??
          exception.message);
    return { status, message };
  }

  const code = prismaCode(exception);
  if (code && PRISMA_ERRORS[code]) return PRISMA_ERRORS[code];

  // Never send internal details (SQL, stack traces) to the client.
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { status, message } = toHttpError(exception);
    const requestId = getRequestId(req);

    if (status >= 500) {
      this.logger.error(
        `${requestId ?? '-'} ${req.method} ${req.originalUrl} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
    };
    res.status(status).json(body);
  }
}
