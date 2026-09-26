/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/miniprogram"],
  testMatch: ["**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js"],
};
