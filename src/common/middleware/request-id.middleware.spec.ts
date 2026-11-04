import { jest } from '@jest/globals';
import { requestIdMiddleware } from './request-id.middleware';

function run(incoming?: string) {
  const headers: Record<string, string> = {};
  if (incoming !== undefined) headers['x-request-id'] = incoming;
  const req = {
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  };
  const res = { setHeader: jest.fn(), on: jest.fn() };
  const next = jest.fn();
  requestIdMiddleware(req as never, res as never, next);
  return { req, res, next };
}

describe('requestIdMiddleware', () => {
  it('creates a new id and returns it in X-Request-Id', () => {
    const { req, res, next } = run();
    const id = req.headers['x-request-id'];

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
    expect(next).toHaveBeenCalled();
  });

  it('keeps a valid id sent by the client', () => {
    expect(run('client-42').req.headers['x-request-id']).toBe('client-42');
  });

  it('replaces an invalid or too long id', () => {
    expect(run('bad id; drop').req.headers['x-request-id']).not.toBe(
      'bad id; drop',
    );
    expect(run('a'.repeat(65)).req.headers['x-request-id']).toHaveLength(36);
  });
});
