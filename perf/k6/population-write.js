// Write-heavy scenario: contributors add population records, verifiers review them.
//
//   k6 run perf/k6/population-write.js
//   k6 run -e QUICK=1 perf/k6/population-write.js        (20-second check)
//   k6 run --summary-export=perf/results/population-write.json perf/k6/population-write.js
//
// Needs the API running and the test data:  npm run perf:seed
// Clean up afterwards (removes the records this test added):
//   npm run perf:seed -- --clean
//
// Two groups of virtual users work at the same time (50 at the peak, like the
// other scenarios):
//
//   contributors (40 users)  POST /villages/:id/population
//       a random test village, a random year and one of the two seed sources.
//   verifiers (10 users)     GET /verification/queue, then
//       PATCH /verification/population-records/:id/verify on a random item of the queue.
//
// Why it is built like this:
// - Each group logs in ONCE in setup(): login is rate limited (5 per minute per IP).
//   The tokens live 15 minutes, which is enough for the 2-minute run.
// - Only test data is changed. The queue lists everything that is pending, so the
//   verifiers only touch population records of the test villages (ids >= 10001), never
//   the 6 development villages. `npm run perf:seed -- --clean` removes all of it.
// - The test villages already have figures for 2007 and 2017 (from source 1), so the
//   random years are 1600-2000. Two contributors can still pick the same village, year
//   and source: the API answers 409, which is correct behaviour, so 409 is an expected
//   answer here (counted in population_duplicates, not as an error).
// - Two verifiers can pick the same item: the second one gets 409 ("already verified"),
//   which is also expected (counted in verify_conflicts).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  API,
  FIRST_VILLAGE_ID,
  THRESHOLDS,
  perEndpoint,
  pick,
  randomInt,
  randomVillageId,
  stages,
} from './lib/config.js';
import { ACCOUNTS, login } from './lib/auth.js';

const ENDPOINTS = [
  'population_create',
  'verification_queue',
  'verification_verify',
];

export const options = {
  scenarios: {
    contributors: {
      executor: 'ramping-vus',
      exec: 'contribute',
      stages: stages(40),
    },
    verifiers: {
      executor: 'ramping-vus',
      exec: 'verify',
      stages: stages(10),
    },
  },
  thresholds: {
    ...THRESHOLDS,
    ...perEndpoint(ENDPOINTS),
    // the test must really write and verify something
    population_created: ['count>0'],
    verified_ok: ['count>0'],
  },
};

const populationCreated = new Counter('population_created');
const populationDuplicates = new Counter('population_duplicates');
const verifiedOk = new Counter('verified_ok');
const verifyConflicts = new Counter('verify_conflicts');

// Seed sources (prisma/seed.ts): ids 1 and 2.
const SOURCE_IDS = [1, 2];

// 201 Created or 409 (same source, village and year already used) are both fine.
const CREATE_OK = http.expectedStatuses(201, 409);
// 200 verified, or 409 when another verifier was faster.
const VERIFY_OK = http.expectedStatuses(200, 409);

/** Logs in once per group; the tokens are passed to the virtual users. */
export function setup() {
  return {
    contributor: login(ACCOUNTS.contributor),
    verifier: login(ACCOUNTS.verifier),
  };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Contributor: adds a population record for a random test village and year. */
export function contribute(data) {
  const population = randomInt(50, 20000);
  const body = {
    year: randomInt(1600, 2000),
    population,
    sourceId: pick(SOURCE_IDS),
  };
  if (Math.random() < 0.5) {
    body.households = randomInt(1, Math.max(1, Math.floor(population / 3)));
  }

  const res = http.post(
    `${API}/villages/${randomVillageId()}/population`,
    JSON.stringify(body),
    {
      headers: {
        ...bearer(data.contributor),
        'Content-Type': 'application/json',
      },
      tags: { name: 'population_create' },
      responseCallback: CREATE_OK,
    },
  );

  if (res.status === 409) {
    populationDuplicates.add(1);
  } else if (
    check(res, {
      'create: status 201': (r) => r.status === 201,
      'create: saved as PENDING': (r) =>
        r.status === 201 && r.json('record.status') === 'PENDING',
    })
  ) {
    populationCreated.add(1);
  }

  // Think time between actions (0.5 to 1.5 s), like a real person.
  sleep(0.5 + Math.random());
}

/** Verifier: opens the review queue and verifies one test record from it. */
export function verify(data) {
  const queue = http.get(`${API}/verification/queue?limit=50`, {
    headers: bearer(data.verifier),
    tags: { name: 'verification_queue' },
  });
  const ok = check(queue, {
    'queue: status 200': (r) => r.status === 200,
    'queue: has a data list': (r) => Array.isArray(r.json('data')),
  });

  if (ok) {
    // Only records of the test villages (never the development data).
    const mine = queue
      .json('data')
      .filter(
        (item) =>
          item.type === 'population-records' &&
          item.villageId >= FIRST_VILLAGE_ID,
      );

    if (mine.length > 0) {
      const item = pick(mine);
      const res = http.patch(
        `${API}/verification/population-records/${item.id}/verify`,
        null,
        {
          headers: bearer(data.verifier),
          tags: { name: 'verification_verify' },
          responseCallback: VERIFY_OK,
        },
      );

      if (res.status === 409) {
        verifyConflicts.add(1);
      } else if (
        check(res, { 'verify: status 200': (r) => r.status === 200 })
      ) {
        verifiedOk.add(1);
      }
    }
  }

  sleep(0.5 + Math.random());
}
