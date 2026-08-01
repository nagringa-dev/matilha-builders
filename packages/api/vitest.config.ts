import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Modules under test import @matilha-builders/env/server, which validates
		// the real environment at import time. Tests exercise pure logic and mock
		// anything that reads config, so skip the validation instead of teaching
		// the suite a full set of fake credentials.
		env: { SKIP_ENV_VALIDATION: "1" },
		environment: "node",
	},
});
