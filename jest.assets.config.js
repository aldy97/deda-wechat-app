/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/miniprogram"],
  testMatch: [
    "**/app-assets.spec.ts",
    "**/elly-image.spec.ts",
    "**/asset-selftest.page.spec.ts",
  ],
  moduleFileExtensions: ["ts", "js"],
  collectCoverageFrom: [
    "miniprogram/utils/app-assets.ts",
    "miniprogram/components/elly-image/elly-image.ts",
    "miniprogram/pages/asset-selftest/asset-selftest.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
