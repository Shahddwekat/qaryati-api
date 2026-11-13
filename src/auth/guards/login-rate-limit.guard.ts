import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Limits login attempts per client IP: at most LOGIN_RATE_LIMIT attempts
 * (default 5) in a window of LOGIN_RATE_TTL_MS milliseconds (default 60000).
 * The next attempt in the same window gets 429 and a Retry-After header.
 *
 * Every attempt counts, successful or not, so password guessing is slowed
 * down without telling the client whether a guess was right.
 *
 * The counters live in memory, which is enough for one API instance. With
 * several instances behind a load balancer they would need a shared store
 * (for example Redis).
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly limit = positiveInt('LOGIN_RATE_LIMIT', 5);
  private readonly windowMs = positiveInt('LOGIN_RATE_TTL_MS', 60_000);
  private readonly attempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const now = Date.now();
    const key = req.ip ?? 'unknown';

    let entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.removeExpired(now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.attempts.set(key, entry);
    }
    entry.count++;

    if (entry.count > this.limit) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(seconds));
      throw new HttpException(
        `Too many login attempts. Try again in ${seconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  // Keeps the map small: forget clients whose window is over.
  private removeExpired(now: number): void {
    for (const [key, entry] of this.attempts) {
      if (entry.resetAt <= now) this.attempts.delete(key);
    }
  }
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}
