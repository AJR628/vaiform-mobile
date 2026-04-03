module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/?(*.)+(test).[tj]s?(x)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/server_dist/",
    "<rootDir>/.cache/",
    "<rootDir>/.bun/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/.cache/",
    "<rootDir>/.bun/",
  ],
  clearMocks: true,
};
