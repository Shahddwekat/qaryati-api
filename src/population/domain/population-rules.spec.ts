import {
  MAX_POPULATION_PER_VILLAGE,
  detectImplausibleChange,
  toYearlyFigures,
  validatePopulationInput,
} from './population-rules';

const NOW = 2026;

describe('validatePopulationInput', () => {
  it('accepts a normal record', () => {
    expect(
      validatePopulationInput(
        { year: 1997, population: 1200, households: 200 },
        NOW,
      ),
    ).toEqual([]);
  });

  it('accepts a population of 0 (depopulated village)', () => {
    expect(validatePopulationInput({ year: 1949, population: 0 }, NOW)).toEqual(
      [],
    );
  });

  it.each([
    ['year before 1500', { year: 1499, population: 10 }],
    ['year in the future', { year: NOW + 1, population: 10 }],
    ['non-integer year', { year: 1997.5, population: 10 }],
  ])('rejects %s', (_name, input) => {
    expect(validatePopulationInput(input, NOW)[0]).toMatch(
      /year must be between/,
    );
  });

  it('accepts the boundary years', () => {
    expect(validatePopulationInput({ year: 1500, population: 1 }, NOW)).toEqual(
      [],
    );
    expect(validatePopulationInput({ year: NOW, population: 1 }, NOW)).toEqual(
      [],
    );
  });

  it('rejects a negative or fractional population', () => {
    expect(
      validatePopulationInput({ year: 2000, population: -1 }, NOW),
    ).toHaveLength(1);
    expect(
      validatePopulationInput({ year: 2000, population: 10.5 }, NOW),
    ).toHaveLength(1);
  });

  it('rejects an absurd population (probable typo)', () => {
    const errors = validatePopulationInput(
      { year: 2000, population: MAX_POPULATION_PER_VILLAGE + 1 },
      NOW,
    );
    expect(errors[0]).toMatch(/cannot be more than/);
  });

  it('rejects households greater than population', () => {
    expect(
      validatePopulationInput(
        { year: 2000, population: 100, households: 101 },
        NOW,
      ),
    ).toEqual(['households cannot be greater than population']);
  });

  it('accepts households equal to population and null households', () => {
    expect(
      validatePopulationInput(
        { year: 2000, population: 100, households: 100 },
        NOW,
      ),
    ).toEqual([]);
    expect(
      validatePopulationInput(
        { year: 2000, population: 100, households: null },
        NOW,
      ),
    ).toEqual([]);
  });

  it('reports every violation at once', () => {
    const errors = validatePopulationInput(
      { year: 3000, population: 5, households: 9 },
      NOW,
    );
    expect(errors).toHaveLength(2);
  });
});

describe('toYearlyFigures', () => {
  it('keeps the preferred record of a year, even if it is older', () => {
    const result = toYearlyFigures([
      { id: 1, year: 1997, population: 1000, isPreferred: true },
      { id: 2, year: 1997, population: 1100, isPreferred: null },
    ]);
    expect(result).toEqual([{ year: 1997, population: 1000 }]);
  });

  it('falls back to the most recent record when none is preferred', () => {
    const result = toYearlyFigures([
      { id: 3, year: 1997, population: 500, isPreferred: null },
      { id: 4, year: 1997, population: 550, isPreferred: null },
    ]);
    expect(result).toEqual([{ year: 1997, population: 550 }]);
  });

  it('returns years in ascending order', () => {
    const result = toYearlyFigures([
      { id: 1, year: 2007, population: 1300, isPreferred: null },
      { id: 2, year: 1997, population: 1000, isPreferred: null },
    ]);
    expect(result.map((r) => r.year)).toEqual([1997, 2007]);
  });
});

describe('detectImplausibleChange', () => {
  const known = [
    { year: 1997, population: 1000 },
    { year: 2017, population: 1500 },
  ];

  it('is quiet for normal growth', () => {
    expect(
      detectImplausibleChange({ year: 2007, population: 1200 }, known),
    ).toEqual([]);
  });

  it('warns about a jump compared with the earlier figure', () => {
    const warnings = detectImplausibleChange(
      { year: 2007, population: 12000 },
      known,
    );
    expect(warnings[0]).toMatch(/per year compared with 1000 in 1997/);
  });

  it('warns about a drop compared with the later figure', () => {
    const warnings = detectImplausibleChange(
      { year: 2007, population: 20 },
      known,
    );
    expect(warnings.some((w) => w.includes('1500 in 2017'))).toBe(true);
  });

  it('can warn on both sides at once', () => {
    expect(
      detectImplausibleChange({ year: 2007, population: 100000 }, known),
    ).toHaveLength(2);
  });

  it('never warns when a neighbour is 0 (depopulated village)', () => {
    expect(
      detectImplausibleChange({ year: 1960, population: 800 }, [
        { year: 1948, population: 0 },
      ]),
    ).toEqual([]);
    expect(
      detectImplausibleChange({ year: 1948, population: 0 }, [
        { year: 1945, population: 900 },
      ]),
    ).toEqual([]);
  });

  it('ignores a figure of the same year (another source)', () => {
    expect(
      detectImplausibleChange({ year: 1997, population: 5000 }, [
        { year: 1997, population: 1000 },
      ]),
    ).toEqual([]);
  });

  it('has nothing to compare with when no figures are known', () => {
    expect(
      detectImplausibleChange({ year: 1997, population: 999 }, []),
    ).toEqual([]);
  });
});
