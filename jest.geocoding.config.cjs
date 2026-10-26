
module.exports = {
    rootDir: '.',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/geocoding/**/*.spec.ts'],
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

  