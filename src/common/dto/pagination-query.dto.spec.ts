import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto, toPage, toSkipTake } from './pagination-query.dto';

const errorsOf = async (plain: object) =>
  (await validate(plainToInstance(PaginationQueryDto, plain))).map(
    (e) => e.property,
  );

describe('PaginationQueryDto', () => {
  it('defaults to page 1 and limit 20', () => {
    const q = plainToInstance(PaginationQueryDto, {});
    expect(q).toMatchObject({ page: 1, limit: 20 });
  });

  it('turns query-string text into numbers', () => {
    const q = plainToInstance(PaginationQueryDto, { page: '3', limit: '5' });
    expect(q).toMatchObject({ page: 3, limit: 5 });
  });

  it.each([
    ['page 0', { page: '0' }, 'page'],
    ['negative page', { page: '-1' }, 'page'],
    ['text page', { page: 'abc' }, 'page'],
    ['limit 0', { limit: '0' }, 'limit'],
    ['limit above 100', { limit: '101' }, 'limit'],
    ['fractional limit', { limit: '2.5' }, 'limit'],
  ])('rejects %s', async (_name, plain, property) => {
    expect(await errorsOf(plain)).toContain(property);
  });
});

describe('toSkipTake / toPage', () => {
  it('computes skip and take from page and limit', () => {
    expect(
      toSkipTake(
        Object.assign(new PaginationQueryDto(), { page: 3, limit: 10 }),
      ),
    ).toEqual({
      skip: 20,
      take: 10,
    });
  });

  it('builds the { data, meta } response with totalPages rounded up', () => {
    const query = Object.assign(new PaginationQueryDto(), {
      page: 2,
      limit: 5,
    });
    expect(toPage(['a', 'b'], 12, query)).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
    });
  });

  it('returns totalPages 0 for an empty result', () => {
    expect(toPage([], 0, new PaginationQueryDto()).meta.totalPages).toBe(0);
  });
});
