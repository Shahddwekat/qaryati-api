
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  API,
  THRESHOLDS,
  perEndpoint,
  stages,
} from './lib/config.js';

// Performance test for the login endpoint.
// Run only against a local test database.
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

export default function () {
  // Use a dedicated test account, not a real user.
  const email = __ENV.TEST_EMAIL;
  const password = __ENV.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD are required');
  }

  const response = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: {
        name: 'auth_login',
      },
    }
  );

  check(response, {
    'login: status 200': (r) => r.status === 200,
    'login: access token returned': (r) =>
      r.status === 200 && !!r.json('accessToken'),
  });

  sleep(0.5 + Math.random());
}
