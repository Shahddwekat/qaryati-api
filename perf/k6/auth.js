// Performance test for the login endpoint.
//
// Login is rate limited (5 per minute per IP by default) and every k6 user
// comes from the same IP, so start the API with a high limit for this test:
//
//   Windows:  set LOGIN_RATE_LIMIT=100000 && npm run start:prod
//   macOS/Linux:  LOGIN_RATE_LIMIT=100000 npm run start:prod
//
//   k6 run -e QUICK=1 perf/k6/auth.js     (20-second check)
//   k6 run perf/k6/auth.js                (real run, about 2 minutes)
//
// Login is expected to be slower than reads: passwords are checked with
// bcrypt (cost 12), which is slow on purpose to make guessing expensive.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, THRESHOLDS, perEndpoint, stages } from './lib/config.js';
import { ACCOUNTS, DEFAULT_PASSWORD } from './lib/auth.js';

export const options = {
  scenarios: {
    main: {
      executor: 'ramping-vus',
      stages: stages(50),
    },
  },
  thresholds: {
    ...THRESHOLDS,
    ...perEndpoint(['auth_login']),
  },
};

const EMAIL = __ENV.TEST_EMAIL || ACCOUNTS.contributor;

export default function () {
  const response = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: EMAIL, password: DEFAULT_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login' },
    },
  );

  check(response, {
    'login: status 201': (r) => r.status === 201,
    'login: access token returned': (r) =>
      r.status === 201 && !!r.json('accessToken'),
    'login: not rate limited (start the API with LOGIN_RATE_LIMIT=100000)': (
      r,
    ) => r.status !== 429,
  });

  sleep(0.5 + Math.random());
}
