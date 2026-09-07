import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";

async function main(): Promise<void> {
  // fail fast if the database is unreachable rather than accepting requests we can't serve
  await pool.query("select 1");

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[api] listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
