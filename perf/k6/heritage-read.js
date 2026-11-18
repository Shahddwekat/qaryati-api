// Read scenario for the heritage lists of a village: what a visitor does on the
// "heritage" part of a village page.
//
//   k6 run perf/k6/heritage-read.js
//   k6 run -e QUICK=1 perf/k6/heritage-read.js        (20-second check)
//   k6 run --summary-export=perf/results/heritage-read.json perf/k6/heritage-read.js
//
// Needs the API running and the test data:  npm run perf:seed
//
// Mix of requests per iteration (a random test village each time):
//   25% landmarks            GET /villages/:id/landmarks
//   20% historical events    GET /villages/:id/historical-events
//   20% cultural traits      GET /villages/:id/cultural-traits
//   15% economic activities  GET /villages/:id/economic-activities
//   20% facilities           GET /villages/:id/facilities
//
// Good to know:
// - All five endpoints are public (no login needed) and read-only.
// - `npm run perf:seed` adds a few heritage rows to about 1 village in 10, so most
//   lists are empty ([]). That is fine: the check is the status (200) and that the
//   answer is a list. Villages that have rows also measure the join with the source.
// - The villages are the test villages (ids from 10001), never the 6 development ones.

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  API,
  THRESHOLDS,
  perEndpoint,
  randomVillageId,
  stages,
} from './lib/config.js';

const ENDPOINTS = [
  'landmarks',
  'historical_events',
  'cultural_traits',
  'economic_activities',
  'facilities',
];

export const options = {
  scenarios: {
    browse: { executor: 'ramping-vus', stages: stages(50) },
  },
  thresholds: { ...THRESHOLDS, ...perEndpoint(ENDPOINTS) },
};

// [name tag, path after /villages/:id/, share of the traffic]
const MIX = [
  ['landmarks', 'landmarks', 0.25],
  ['historical_events', 'historical-events', 0.2],
  ['cultural_traits', 'cultural-traits', 0.2],
  ['economic_activities', 'economic-activities', 0.15],
  ['facilities', 'facilities', 0.2],
];

function choose(roll) {
  let total = 0;
  for (const item of MIX) {
    total += item[2];
    if (roll < total) return item;
  }
  return MIX[MIX.length - 1];
}

function get(url, name) {
  const res = http.get(url, { tags: { name } });
  check(res, {
    [`${name}: status 200`]: (r) => r.status === 200,
    [`${name}: answer is a list`]: (r) =>
      r.status === 200 && Array.isArray(r.json()),
  });
  return res;
}

export default function () {
  const [name, path] = choose(Math.random());
  get(`${API}/villages/${randomVillageId()}/${path}`, name);

  // Think time between clicks (0.5 to 1.5 s), like a real visitor.
  sleep(0.5 + Math.random());
}
