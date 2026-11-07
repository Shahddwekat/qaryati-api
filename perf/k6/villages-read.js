// Read-heavy scenario for villages: what most visitors do.
//
//   k6 run perf/k6/villages-read.js
//   k6 run -e QUICK=1 perf/k6/villages-read.js        (20-second check)
//
// Needs the API running and the test data:  npm run perf:seed
//
// Mix of requests per iteration (like real users browsing):
//   35% list a page of villages          GET /villages?page=&limit=20
//   25% search by name (full-text)        GET /villages?q=
//   25% open one village                  GET /villages/:id
//   15% nearby villages                   GET /villages/:id/nearby

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  API,
  THRESHOLDS,
  perEndpoint,
  pick,
  randomInt,
  randomVillageId,
  stages,
} from './lib/config.js';

const ENDPOINTS = ['list', 'search', 'details', 'nearby'];

export const options = {
  scenarios: {
    browse: { executor: 'ramping-vus', stages: stages(50) },
  },
  thresholds: { ...THRESHOLDS, ...perEndpoint(ENDPOINTS) },
};

// Words that exist in the test data (prisma/seed-perf.ts), in both languages.
const SEARCH_WORDS = [
  'kafr',
  'beit',
  'zaytoun',
  'rumman',
  'safsaf',
  'emmaus',
  'shiloh',
  'كفر',
  'الزيتون',
  'الريحان',
];

function get(url, name) {
  const res = http.get(url, { tags: { name } });
  check(res, { [`${name}: status 200`]: (r) => r.status === 200 });
  return res;
}

export default function () {
  const roll = Math.random();

  if (roll < 0.35) {
    get(`${API}/villages?page=${randomInt(1, 50)}&limit=20`, 'list');
  } else if (roll < 0.6) {
    const res = get(
      `${API}/villages?q=${encodeURIComponent(pick(SEARCH_WORDS))}&limit=20`,
      'search',
    );
    check(res, {
      'search: has results': (r) =>
        r.status === 200 && r.json('data').length > 0,
    });
  } else if (roll < 0.85) {
    get(`${API}/villages/${randomVillageId()}`, 'details');
  } else {
    const radius = pick([2, 5, 10, 20]);
    get(
      `${API}/villages/${randomVillageId()}/nearby?radiusKm=${radius}`,
      'nearby',
    );
  }

  // Think time between clicks (0.5 to 1.5 s), like a real visitor.
  sleep(0.5 + Math.random());
}
