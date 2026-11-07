// Template for a new k6 scenario. Copy it to perf/k6/<your-scenario>.js.
//
//   k6 run -e QUICK=1 perf/k6/<your-scenario>.js   (check that it works, 20 s)
//   k6 run perf/k6/<your-scenario>.js              (the real run, about 2 minutes)
//
// Rules so all results are comparable:
// - use stages() and THRESHOLDS from lib/config.js (do not change them per file)
// - give every request a name tag; add the names to perEndpoint([...])
// - use the test villages (randomVillageId()), never the 6 development villages
// - write requests that change data so they can run many times (unique values)

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  API,
  THRESHOLDS,
  perEndpoint,
  randomVillageId,
  stages,
} from './lib/config.js';

export const options = {
  scenarios: {
    main: { executor: 'ramping-vus', stages: stages(50) },
  },
  thresholds: { ...THRESHOLDS, ...perEndpoint(['example']) },
};

export default function () {
  const res = http.get(`${API}/villages/${randomVillageId()}`, {
    tags: { name: 'example' },
  });
  check(res, { 'example: status 200': (r) => r.status === 200 });

  sleep(0.5 + Math.random());
}
