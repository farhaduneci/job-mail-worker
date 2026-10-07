import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Tests stub the AI binding; never reach a real Cloudflare account.
      remoteBindings: false,
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations("./migrations") },
      },
    }),
  ],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
}));
