import "dotenv/config";
import { spawnSync } from "node:child_process";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");

const testUrl = new URL(source);
const databaseName = "finnances_test";
testUrl.pathname = `/${databaseName}`;
const maintenanceUrl = new URL(testUrl);
maintenanceUrl.pathname = "/postgres";

const sql = `CREATE DATABASE \"${databaseName}\"`;
const result = spawnSync("psql", [maintenanceUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: ["ignore", "ignore", "pipe"] });
if (result.status !== 0) {
  const error = result.stderr?.toString() ?? "";
  if (!error.includes("already exists")) throw new Error(error.trim() || "Could not prepare test database");
}

process.stdout.write(testUrl.toString());
