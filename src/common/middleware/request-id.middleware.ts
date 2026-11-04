import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// A client may send its own id (letters, digits, "-" and "_", at most 64 chars).
const VALID_ID = /^[\w-]{1,64}$/;

const logger = new Logger('HTTP');

/**
 * Gives every request an id, returns it in the X-Request-Id response header
 * and writes one log line per request when the response is sent:
 *   <id> GET /api/v1/villages 200 12ms
 * The same id appears in error responses, so a user can report it and we can
 * find the request in the logs.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  req.headers[REQUEST_ID_HEADER] = id;
  res.setHeader('X-Request-Id', id);

  const started = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return; // keep test output readable
    logger.log(
      `${id} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`,
    );
  });
  next();
}

export function getRequestId(req: Request): string | undefined {
  const id = req.headers[REQUEST_ID_HEADER];
  return typeof id === 'string' ? id : undefined;
}
