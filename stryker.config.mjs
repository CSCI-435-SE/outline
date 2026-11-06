// @ts-check
/**
 * Mutation testing config. Mutating the whole monorepo takes a very long time,
 * so narrow the scope from the CLI when iterating, e.g.:
 *
 *   yarn test:mutation --mutate "shared/utils/color.ts"
 *
 * Server tests need Postgres and Redis running (see STUDENTS.md). Most server
 * tests import most server code, so when mutating server files also set
 * STRYKER_VITEST_INCLUDE to the relevant test files, e.g.:
 *
 *   STRYKER_VITEST_INCLUDE=server/utils/fs.test.ts \
 *     yarn test:mutation --mutate "server/utils/fs.ts"
 *
 * STRYKER_VITEST_PROJECTS skips whole projects instead. Both are documented in
 * vitest.stryker.config.ts.
 *
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
const config = {
  packageManager: "yarn",
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: {
    configFile: "vitest.stryker.config.ts",
    // Only run the tests related to each mutated file.
    related: true,
  },
  mutate: [
    "{app,server,shared,plugins}/**/*.{ts,tsx}",
    "!**/*.test.{ts,tsx}",
    "!**/test/**",
    "!**/__mocks__/**",
    "!**/*.d.ts",
    "!server/migrations/**",
    "!server/scripts/**",
  ],
  // Keep the sandbox copy small; these aren't needed to run tests.
  ignorePatterns: [
    "build",
    "outline-data",
    "ai-logs",
    ".specstory",
    "docs",
    "reports",
  ],
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
  tempDirName: ".stryker-tmp",
  // Static (module-level) mutants rerun every related test file, which is very
  // slow here. Remove this to include them.
  ignoreStatic: true,
  concurrency: 4,
  timeoutMS: 60000,
  // The initial run executes every test related to the mutated files in a
  // single worker; for server files that can be a large part of the suite.
  dryRunTimeoutMinutes: 60,
};

export default config;
