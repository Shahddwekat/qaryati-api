import { toBooleanQuery } from './search-terms';

describe('toBooleanQuery', () => {
  it.each([
    ['one Arabic word', 'سبسطية', '+سبسطية*'],
    ['an Arabic prefix', 'سبس', '+سبس*'],
    ['two words, all required', 'Kafr Qaddum', '+Kafr* +Qaddum*'],
    ['extra spaces', '  Burqa   ', '+Burqa*'],
  ])('builds a query for %s', (_name, input, expected) => {
    expect(toBooleanQuery(input)).toBe(expected);
  });

  it('removes boolean-mode operators so input cannot change the query', () => {
    expect(toBooleanQuery('+bur* -("x") <y> ~z @2')).toBe('+bur*');
  });

  it('drops words shorter than the full-text minimum token size', () => {
    expect(toBooleanQuery('al Burqa')).toBe('+Burqa*');
    expect(toBooleanQuery('ab cd')).toBeNull();
  });

  it('returns null when nothing searchable is left', () => {
    expect(toBooleanQuery('***')).toBeNull();
    expect(toBooleanQuery('')).toBeNull();
  });

  it('keeps at most five words', () => {
    expect(toBooleanQuery('one two three four five six seven')).toBe(
      '+one* +two* +three* +four* +five*',
    );
  });
});
