/**
 * Pure business rules for population records. No framework, no database:
 * they can be unit-tested directly and reused by any layer.
 */

export const MIN_POPULATION_YEAR = 1500; // earliest written records we accept (Ottoman registers)
export const MAX_POPULATION_PER_VILLAGE = 1_000_000; // sanity limit, catches typos like an extra zero
export const MAX_PLAUSIBLE_ANNUAL_CHANGE = 0.1; // above 10% per year we warn, we do not reject

export interface PopulationInput {
  year: number;
  population: number;
  households?: number | null;
}

/** One population figure, used to compare a new record with what is already known. */
export interface KnownFigure {
  year: number;
  population: number;
}

export interface RecordFigure extends KnownFigure {
  id: number;
  isPreferred: boolean | null;
}

/**
 * Hard rules: a record that breaks one of them is rejected (HTTP 400).
 * Returns the list of violations, empty when the input is valid.
 */
export function validatePopulationInput(
  input: PopulationInput,
  currentYear: number,
): string[] {
  const errors: string[] = [];

  if (
    !Number.isInteger(input.year) ||
    input.year < MIN_POPULATION_YEAR ||
    input.year > currentYear
  ) {
    errors.push(
      `year must be between ${MIN_POPULATION_YEAR} and ${currentYear}`,
    );
  }

  if (!Number.isInteger(input.population) || input.population < 0) {
    errors.push('population must be a whole number, 0 or more');
  } else if (input.population > MAX_POPULATION_PER_VILLAGE) {
    errors.push(
      `population cannot be more than ${MAX_POPULATION_PER_VILLAGE} for a single village`,
    );
  }

  if (input.households !== undefined && input.households !== null) {
    if (!Number.isInteger(input.households) || input.households < 0) {
      errors.push('households must be a whole number, 0 or more');
    } else if (input.households > input.population) {
      errors.push('households cannot be greater than population');
    }
  }

  return errors;
}

/**
 * Collapses several records of the same year into ONE figure per year:
 * the preferred record if there is one, otherwise the most recent record.
 * This matches how the population-trends report picks its numbers.
 */
export function toYearlyFigures(records: RecordFigure[]): KnownFigure[] {
  const rank = (r: RecordFigure) => (r.isPreferred ? 1e12 : 0) + r.id;
  const byYear = new Map<number, RecordFigure>();
  for (const r of records) {
    const current = byYear.get(r.year);
    if (!current || rank(r) > rank(current)) {
      byYear.set(r.year, r);
    }
  }
  return [...byYear.values()]
    .map(({ year, population }) => ({ year, population }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Soft rule: compares a new figure with the closest earlier and later known
 * figures. A very large yearly change is a sign of a typo or a wrong source, so
 * we return warnings for the verifier instead of blocking the record (real
 * history includes sudden drops, for example displacement in 1948).
 * A figure of 0 on either side is never flagged: depopulated villages exist.
 */
export function detectImplausibleChange(
  candidate: KnownFigure,
  known: KnownFigure[],
): string[] {
  const others = known.filter((k) => k.year !== candidate.year);
  const before = others
    .filter((k) => k.year < candidate.year)
    .sort((a, b) => b.year - a.year)[0];
  const after = others
    .filter((k) => k.year > candidate.year)
    .sort((a, b) => a.year - b.year)[0];

  const warnings: string[] = [];
  const check = (from: KnownFigure, to: KnownFigure, other: KnownFigure) => {
    if (from.population === 0 || to.population === 0) return;
    const years = to.year - from.year;
    const annualRate = Math.pow(to.population / from.population, 1 / years) - 1;
    if (Math.abs(annualRate) > MAX_PLAUSIBLE_ANNUAL_CHANGE) {
      const percent = Math.round(annualRate * 1000) / 10;
      warnings.push(
        `A population of ${candidate.population} in ${candidate.year} means a change of ${percent}% per year ` +
          `compared with ${other.population} in ${other.year}. Please check the source.`,
      );
    }
  };

  if (before) check(before, candidate, before);
  if (after) check(candidate, after, after);
  return warnings;
}
