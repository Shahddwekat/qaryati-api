import { jest } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

function context(ip: string) {
  const res = { setHeader: jest.fn() };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => res,
    }),
  };
  return { ctx: ctx as never, res };
}

describe('LoginRateLimitGuard', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.LOGIN_RATE_LIMIT = '3';
    process.env.LOGIN_RATE_TTL_MS = '60000';
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env = { ...saved };
    jest.useRealTimers();
  });

  it('allows the limit, then answers 429 with Retry-After', () => {
    const guard = new LoginRateLimitGuard();
    for (let i = 0; i < 3; i++) {
      expect(guard.canActivate(context('1.1.1.1').ctx)).toBe(true);
    }

    const { ctx, res } = context('1.1.1.1');
    let error: unknown;
    try {
      guard.canActivate(ctx);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('counts each IP separately', () => {
    const guard = new LoginRateLimitGuard();
    for (let i = 0; i < 3; i++) guard.canActivate(context('1.1.1.1').ctx);

    expect(guard.canActivate(context('2.2.2.2').ctx)).toBe(true);
  });

  it('allows attempts again after the window', () => {
    const guard = new LoginRateLimitGuard();
    for (let i = 0; i < 3; i++) guard.canActivate(context('1.1.1.1').ctx);
    expect(() => guard.canActivate(context('1.1.1.1').ctx)).toThrow(
      HttpException,
    );

    jest.advanceTimersByTime(60_001);
    expect(guard.canActivate(context('1.1.1.1').ctx)).toBe(true);
  });

  it('uses 5 per minute by default and rejects invalid settings', () => {
    delete process.env.LOGIN_RATE_LIMIT;
    delete process.env.LOGIN_RATE_TTL_MS;
    const guard = new LoginRateLimitGuard();
    for (let i = 0; i < 5; i++) guard.canActivate(context('3.3.3.3').ctx);
    expect(() => guard.canActivate(context('3.3.3.3').ctx)).toThrow(
      HttpException,
    );

    process.env.LOGIN_RATE_LIMIT = 'abc';
    expect(() => new LoginRateLimitGuard()).toThrow(
      'LOGIN_RATE_LIMIT must be a positive integer',
    );
  });
});
