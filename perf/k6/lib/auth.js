
import http from 'k6/http';
import { API } from './config.js';

/**
 * Logs in once and returns an access token.
 * Use this helper inside setup(), not inside every iteration.
 */
export function login(
  email = __ENV.TEST_EMAIL || 'contributor@qaryati.local',
  password = __ENV.TEST_PASSWORD
) {
  if (!password) {
    throw new Error('TEST_PASSWORD is required for login');
  }

  const response = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login_setup' },
    }
  );

  if (response.status !== 200) {
    throw new Error(`Login failed with HTTP ${response.status}`);
  }

  const data = response.json();

  if (!data.accessToken) {
    throw new Error('Login response does not contain accessToken');
  }

  return data.accessToken;
}

/**
 * Creates authorization headers for protected API requests.
 */
export function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
