import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSourceDto } from './dto/create-source.dto';
import { ListSourcesQueryDto } from './dto/list-sources-query.dto';

const errorsOf = async <T extends object>(cls: new () => T, plain: object) => {
  const errors = await validate(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
};

describe('CreateSourceDto', () => {
  const valid = { type: 'BOOK', title: 'A book' };

  it('accepts a minimal valid body', async () => {
    expect(await errorsOf(CreateSourceDto, valid)).toEqual([]);
  });

  it.each([
    ['unknown type', { ...valid, type: 'PODCAST' }, 'type'],
    ['empty title', { ...valid, title: '' }, 'title'],
    ['title too long', { ...valid, title: 'x'.repeat(301) }, 'title'],
    ['non-http url', { ...valid, url: 'ftp://files.example.org/a' }, 'url'],
    ['url without protocol', { ...valid, url: 'example.org/a' }, 'url'],
    ['year as text', { ...valid, year: 'nineteen' }, 'year'],
    ['year zero', { ...valid, year: 0 }, 'year'],
    ['bad accessedAt', { ...valid, accessedAt: 'yesterday' }, 'accessedAt'],
    ['unknown field', { ...valid, createdBy: 99 }, 'createdBy'],
  ])('rejects %s', async (_name, body, property) => {
    expect(await errorsOf(CreateSourceDto, body)).toContain(property);
  });
});

describe('ListSourcesQueryDto', () => {
  it('applies defaults', () => {
    const dto = plainToInstance(ListSourcesQueryDto, {});
    expect(dto).toMatchObject({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      order: 'desc',
    });
  });

  it('converts numeric strings from the query string', async () => {
    const dto = plainToInstance(ListSourcesQueryDto, { page: '2', limit: '50' });
    expect(dto.page).toBe(2);
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    ['limit above 100', { limit: '101' }, 'limit'],
    ['page zero', { page: '0' }, 'page'],
    ['unknown sort field', { sortBy: 'password' }, 'sortBy'],
    ['bad order', { order: 'sideways' }, 'order'],
    ['bad type', { type: 'NOPE' }, 'type'],
  ])('rejects %s', async (_name, body, property) => {
    expect(await errorsOf(ListSourcesQueryDto, body)).toContain(property);
  });
});
