import type { Config } from "jest";

const config: Config = {
  rootDir: ".",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  moduleNameMapper: {
    "^@gym/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@gym/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1"
  }
};

export default config;
