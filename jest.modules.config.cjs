// Runs the unit tests of the sources, verification and population modules.
//   node --experimental-vm-modules node_modules/jest/bin/jest.js -c jest.modules.config.cjs
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',

  testMatch: [
    '<rootDir>/src/sources/**/*.spec.ts',
    '<rootDir>/src/verification/**/*.spec.ts',
    '<rootDir>/src/population/**/*.spec.ts',
  ],

  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.heritage-spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
