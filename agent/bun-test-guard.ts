throw new Error(
  "`bun test` runs Bun's native test runner, which is not supported in this repo.\n" +
    "The test suite is written for vitest (vi.mock, vi.hoisted, vitest.setup.ts).\n" +
    "Run tests with: bun run test",
);
