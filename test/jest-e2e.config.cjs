// End-to-end tests: start the real Nest app against a real MySQL database.
// Needs `docker compose up -d`, `npx prisma migrate deploy` and `npx prisma db seed` first.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  // Starting the whole app (and Prisma) can take a while, especially on Windows.
  testTimeout: 30000,
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { useESM: true, tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};