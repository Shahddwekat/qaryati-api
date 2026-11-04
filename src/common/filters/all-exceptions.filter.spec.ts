import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter, toHttpError } from './all-exceptions.filter';

describe('toHttpError', () => {
  it('keeps the status and message of HTTP exceptions', () => {
    expect(toHttpError(new NotFoundException('Village 9 not found'))).toEqual({
      status: 404,
      message: 'Village 9 not found',
    });
  });

  it('keeps the list of validation messages', () => {
    const error = new BadRequestException(['name must be a string']);
    expect(toHttpError(error).message).toEqual(['name must be a string']);
  });

  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 409],
    ['P2000', 400],
  ])('maps the Prisma error %s to %i', (code, status) => {
    const error = Object.assign(new Error('prisma said no'), { code });
    expect(toHttpError(error).status).toBe(status);
    expect(toHttpError(error).message).not.toContain('prisma said no');
  });

  it('hides the details of unexpected errors', () => {
    const error = new Error('Unknown column `secret` in SELECT ...');
    expect(toHttpError(error)).toEqual({
      status: 500,
      message: 'Internal server error',
    });
    expect(toHttpError({ code: 'P9999' }).status).toBe(500);
    expect(toHttpError('a string').status).toBe(500);
  });
});

describe('AllExceptionsFilter', () => {
  function run(exception: unknown) {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v1/villages',
          headers: { 'x-request-id': 'abc-123' },
        }),
        getResponse: () => ({ status }),
      }),
    };
    new AllExceptionsFilter().catch(exception, host as never);
    return { status, body: json.mock.calls[0][0] as Record<string, unknown> };
  }

  it('sends the same body shape for every error', () => {
    const { status, body } = run(new ConflictException('Already exists'));

    expect(status).toHaveBeenCalledWith(409);
    expect(body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Already exists',
      path: '/api/v1/villages',
      timestamp: expect.any(String),
      requestId: 'abc-123',
    });
  });

  it('answers 500 for unexpected errors without leaking details', () => {
    const { body } = run(new Error('connection refused at 10.0.0.5'));
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });
});
