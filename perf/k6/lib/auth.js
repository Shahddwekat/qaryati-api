import http from 'k6/http';
import { API } from './config.js';

// Seed accounts (prisma/seed.ts). Override with -e TEST_EMAIL=... -e TEST_PASSWORD=...
export const DEFAULT_PASSWORD = __ENV.TEST_PASSWORD || 'Password123!';
export const ACCOUNTS = {
  admin: 'admin@qaryati.local',
  verifier: 'verifier@qaryati.local',
  contributor: 'contributor@qaryati.local',
};

/**
 * Logs in and returns an access token.
 * Call it in setup() (once per test run), not in every iteration:
 * login is rate limited (LOGIN_RATE_LIMIT per IP, default 5 per minute).
 *
 *   export function setup() {
 *     return { token: login(ACCOUNTS.contributor) };
 *   }
 *   export default function (data) {
 *     http.post(url, body, { headers: authHeaders(data.token) });
 *   }
 */
export function login(
  email = __ENV.TEST_EMAIL || ACCOUNTS.contributor,
  password = DEFAULT_PASSWORD,
) {
  const response = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login_setup' },
    },
  );

  // POST /auth/login answers 201 Created
  if (response.status !== 201) {
    throw new Error(
      `Login as ${email} failed with HTTP ${response.status}: ${response.body}`,
    );
  }

  const accessToken = response.json('accessToken');
  if (!accessToken) {
    throw new Error('Login response does not contain accessToken');
  }
  return accessToken;
}

/** Headers for protected requests. */
export function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
