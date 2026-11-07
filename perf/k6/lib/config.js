// Shared settings for all k6 scenarios.
//
// Change the target with:  k6 run -e BASE_URL=http://localhost:3001 perf/k6/<file>.js
// Short smoke run (20 s):  k6 run -e QUICK=1 perf/k6/<file>.js

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API = `${BASE_URL}/api/v1`;

// Test villages created by `npm run perf:seed` (prisma/seed-perf.ts).
export const FIRST_VILLAGE_ID = 10001;
export const VILLAGE_COUNT = Number(__ENV.PERF_VILLAGES || 5000);

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomVillageId() {
  return randomInt(FIRST_VILLAGE_ID, FIRST_VILLAGE_ID + VILLAGE_COUNT - 1);
}

/**
 * Load profile used by every scenario, so results can be compared:
 * ramp up to the target number of virtual users, hold, ramp down.
 * QUICK=1 gives a 20-second smoke run to check that the script works.
 */
export function stages(target = 50) {
  if (__ENV.QUICK) {
    return [
      { duration: '5s', target: 5 },
      { duration: '10s', target: 5 },
      { duration: '5s', target: 0 },
    ];
  }
  return [
    { duration: '30s', target },
    { duration: '1m', target },
    { duration: '20s', target: 0 },
  ];
}

/** Our targets (see perf/README.md). */
export const THRESHOLDS = {
  http_req_failed: ['rate<0.01'], // less than 1% errors
  http_req_duration: ['p(95)<500'], // 95% of requests faster than 500 ms
  checks: ['rate>0.99'],
};

/** Adds a p95 target per request name, so the summary shows each endpoint. */
export function perEndpoint(names, p95 = 500) {
  const result = {};
  for (const name of names) {
    result[`http_req_duration{name:${name}}`] = [`p(95)<${p95}`];
  }
  return result;
}
