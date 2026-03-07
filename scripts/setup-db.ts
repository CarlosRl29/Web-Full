#!/usr/bin/env npx ts-node
/**
 * Setup database for development.
 * - Waits for postgres to be ready
 * - Creates database from DATABASE_URL if it doesn't exist
 * - Runs prisma migrate deploy
 *
 * Usage: npm run setup:db (from project root)
 * Requires: docker compose with postgres service running
 */
import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

const ROOT = process.cwd();
// Load .env from root or apps/api
const envFile = fs.existsSync(path.join(ROOT, ".env"))
  ? path.join(ROOT, ".env")
  : path.join(ROOT, "apps", "api", ".env");
config({ path: envFile });
const API_DIR = path.join(ROOT, "apps", "api");

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(path.join(ROOT, ".env")) && !fs.existsSync(path.join(ROOT, "apps", "api", ".env"))) {
    throw new Error("No .env found at project root or apps/api");
  }
  return process.env as Record<string, string>;
}

function parseDatabaseUrl(url: string): { user: string; database: string } {
  try {
    const u = new URL(url.replace(/^postgresql:\/\//, "postgres://"));
    return {
      user: u.username || "postgres",
      database: u.pathname?.replace(/^\//, "").split("?")[0] || "postgres"
    };
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }
}

/** Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on Windows */
function hostDatabaseUrl(url: string): string {
  return url.replace(/@localhost\b/, "@127.0.0.1");
}

function dockerComposeExec(
  service: string,
  cmd: string[],
  opts: { cwd?: string } = {}
): { success: boolean; stderr?: string } {
  const cwd = opts.cwd ?? ROOT;
  const result = spawnSync("docker", ["compose", "exec", "-T", service, ...cmd], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    success: result.status === 0,
    stderr: result.stderr
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForPostgres(service: string, maxAttempts = 60): Promise<boolean> {
  console.log("Waiting for postgres (pg_isready)...");
  for (let i = 0; i < maxAttempts; i++) {
    const psResult = spawnSync("docker", ["compose", "ps", "-q", service], {
      cwd: ROOT,
      encoding: "utf-8"
    });
    if (!psResult.stdout?.trim()) {
      process.stdout.write(".");
      await sleep(1000);
      continue;
    }
    const { success } = dockerComposeExec(service, [
      "pg_isready",
      "-U",
      "gym",
      "-d",
      "postgres"
    ]);
    if (success) {
      console.log("Postgres is ready.");
      return true;
    }
    process.stdout.write(".");
    await sleep(Math.min((i + 1) * 500, 3000));
  }
  return false;
}

function ensureDatabase(service: string, user: string, database: string): void {
  const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${database.replace(/'/g, "''")}') THEN
    CREATE DATABASE "${database.replace(/"/g, '""')}";
    RAISE NOTICE 'Database % created.', '${database.replace(/'/g, "''")}';
  ELSE
    RAISE NOTICE 'Database % already exists.', '${database.replace(/'/g, "''")}';
  END IF;
END
$$;
`;
  const { success, stderr } = dockerComposeExec(service, [
    "psql",
    "-U",
    user,
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql.trim()
  ]);
  if (!success) {
    console.error("Failed to ensure database:", stderr);
    throw new Error("Database setup failed");
  }
}

function runPrismaMigrate(dbUrl: string): void {
  console.log("Running prisma migrate deploy...");
  execSync("npm run db:migrate:deploy -w apps/api", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
}

async function main(): Promise<void> {
  const service = process.env.DOCKER_POSTGRES_SERVICE || "postgres";

  console.log("Setup DB: checking docker compose...");
  const composeCheck = spawnSync("docker", ["compose", "ps", "-q", service], {
    cwd: ROOT,
    encoding: "utf-8"
  });
  if (!composeCheck.stdout?.trim()) {
    console.log(`Service "${service}" not running. Start it with: docker compose up -d ${service}`);
    process.exit(1);
  }

  const env = loadEnv();
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL not set in .env");
  }

  const { user, database } = parseDatabaseUrl(dbUrl);
  console.log(`Target database: ${database} (user: ${user})`);

  if (dbUrl.includes("@localhost")) {
    console.log("Note: Replacing localhost with 127.0.0.1 for Windows compatibility.");
  }

  if (!(await waitForPostgres(service))) {
    console.error("Postgres did not become ready in time.");
    process.exit(1);
  }

  ensureDatabase(service, user, database);

  const hostUrl = hostDatabaseUrl(dbUrl);
  runPrismaMigrate(hostUrl);

  console.log("Database setup complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
