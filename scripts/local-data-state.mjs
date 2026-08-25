#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = process.cwd();
const backupRoot = path.join(repoRoot, ".local-backups");
const artworkBucket = "content-artwork";

const authTablesToExclude = [
  "auth.audit_log_entries",
  "auth.custom_oauth_providers",
  "auth.flow_state",
  "auth.instances",
  "auth.mfa_amr_claims",
  "auth.mfa_challenges",
  "auth.mfa_factors",
  "auth.oauth_authorizations",
  "auth.oauth_client_states",
  "auth.oauth_clients",
  "auth.oauth_consents",
  "auth.one_time_tokens",
  "auth.refresh_tokens",
  "auth.saml_providers",
  "auth.saml_relay_states",
  "auth.schema_migrations",
  "auth.sessions",
  "auth.sso_domains",
  "auth.sso_providers",
  "auth.webauthn_challenges",
  "auth.webauthn_credentials",
];

const storageTablesToExclude = [
  "storage.buckets",
  "storage.buckets_analytics",
  "storage.buckets_vectors",
  "storage.iceberg_namespaces",
  "storage.iceberg_tables",
  "storage.migrations",
  "storage.s3_multipart_uploads",
  "storage.s3_multipart_uploads_parts",
  "storage.vector_indexes",
];

function getSupabaseCommand() {
  const npmShimPath = path.join(process.env.APPDATA ?? "", "npm", "supabase.cmd");
  return existsSync(npmShimPath) ? npmShimPath : "supabase";
}

function runSupabase(args) {
  return execFileSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/c", getSupabaseCommand(), ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function parseStatusJson() {
  return JSON.parse(runSupabase(["status", "-o", "json"]));
}

function parseStatusEnv() {
  const env = {};
  const output = runSupabase(["status", "-o", "env"]);

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes("=")) {
      continue;
    }

    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"|"$/g, "");
    env[key] = value;
  }

  return env;
}

function ensureLocalTarget(apiUrl, action) {
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(apiUrl);

  if (!isLocal) {
    throw new Error(`Refusing to ${action} against non-local Supabase target: ${apiUrl}`);
  }
}

function ensureBackupRoot() {
  mkdirSync(backupRoot, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/:/g, "-");
}

function formatObjectPath(objectName) {
  return objectName
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function createStorageClient(apiUrl, serviceRoleKey) {
  return createClient(apiUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function makeTempSqlFile(directory, name, sql) {
  const tempPath = path.join(directory, name);
  writeFileSync(tempPath, `${sql.trim()}\n`);
  return tempPath;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inLineComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (!inSingleQuote && char === "-" && next === "-") {
      inLineComment = true;
      index += 1;
      continue;
    }

    current += char;

    if (char === "'" && inSingleQuote && next === "'") {
      current += next;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === ";" && !inSingleQuote) {
      const statement = current.slice(0, -1).trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

function queryRows(sql, tempDir, tempName) {
  const tempFile = makeTempSqlFile(tempDir, tempName, sql);

  try {
    const response = JSON.parse(runSupabase(["db", "query", "--local", "-f", tempFile, "-o", "json"]));
    return response.rows ?? [];
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  }
}

function execSql(sql, tempDir, tempName) {
  const tempFile = makeTempSqlFile(tempDir, tempName, sql);

  try {
    runSupabase(["db", "query", "--local", "-f", tempFile]);
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }
  }
}

function execSqlStatements(statements, tempDir, prefix) {
  let executed = 0;

  for (const [index, statement] of statements.entries()) {
    const trimmed = statement.trim();
    if (!trimmed || /^set\s+/i.test(trimmed) || /^select\s+pg_catalog\.set_config\s*\(/i.test(trimmed)) {
      continue;
    }

    execSql(trimmed, tempDir, `${prefix}-${String(index).padStart(4, "0")}.sql`);
    executed += 1;
  }

  return executed;
}

function getLatestBackupDir() {
  ensureBackupRoot();
  const entries = readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(backupRoot, entry.name))
    .sort((first, second) => second.localeCompare(first));

  return entries[0] ?? null;
}

function readManifest(backupDir) {
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing backup manifest: ${manifestPath}`);
  }

  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

async function downloadArtworkFiles(apiUrl, serviceRoleKey, objects, destinationDir) {
  mkdirSync(destinationDir, { recursive: true });

  for (const object of objects) {
    const url = `${apiUrl.replace(/\/$/, "")}/storage/v1/object/public/${artworkBucket}/${formatObjectPath(object.name)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${object.name}: ${response.status} ${response.statusText}`);
    }

    const outputPath = path.join(destinationDir, object.name.split("/").join(path.sep));
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  }
}

async function uploadArtworkFiles(apiUrl, serviceRoleKey, objects, sourceDir) {
  const supabase = createStorageClient(apiUrl, serviceRoleKey);

  for (const object of objects) {
    const inputPath = path.join(sourceDir, object.name.split("/").join(path.sep));
    if (!existsSync(inputPath)) {
      throw new Error(`Missing backed up artwork file: ${inputPath}`);
    }

    const contentType = object.metadata?.mimetype || object.metadata?.mimeType || "application/octet-stream";
    const fileBody = new Blob([readFileSync(inputPath)], { type: contentType });
    const { error } = await supabase.storage.from(artworkBucket).upload(object.name, fileBody, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload ${object.name}: ${error.message}`);
    }
  }
}

async function deleteArtworkFiles(apiUrl, serviceRoleKey, objects) {
  const supabase = createStorageClient(apiUrl, serviceRoleKey);

  for (const object of objects) {
    const { error } = await supabase.storage.from(artworkBucket).remove([object.name]);

    if (error) {
      throw new Error(`Failed to delete ${object.name}: ${error.message}`);
    }
  }
}

async function backupCommand() {
  const statusJson = parseStatusJson();
  const statusEnv = parseStatusEnv();
  const apiUrl = statusJson.API_URL;
  const serviceRoleKey = statusEnv.SECRET_KEY;

  if (!apiUrl || !serviceRoleKey) {
    throw new Error("Missing local Supabase API URL or service key.");
  }

  ensureLocalTarget(apiUrl, "back up");
  ensureBackupRoot();

  const backupDir = path.join(backupRoot, timestamp());
  const storageDir = path.join(backupDir, "storage", artworkBucket);
  mkdirSync(storageDir, { recursive: true });

  const dumpFilePath = path.join(backupDir, "database.sql");
  const excludeArgs = [...authTablesToExclude, ...storageTablesToExclude].flatMap((table) => ["-x", table]);
  runSupabase([
    "db",
    "dump",
    "--local",
    "--data-only",
    "-s",
    "auth,public,storage",
    ...excludeArgs,
    "-f",
    dumpFilePath,
  ]);

  const objectRows = queryRows(
    [
      "select name, metadata, created_at, updated_at",
      "from storage.objects",
      `where bucket_id = '${artworkBucket}'`,
      "order by name",
    ].join(" "),
    backupDir,
    "objects.sql",
  );

  await downloadArtworkFiles(apiUrl, serviceRoleKey, objectRows, storageDir);

  const manifest = {
    apiUrl,
    createdAt: new Date().toISOString(),
    databaseDump: "database.sql",
    storage: {
      artworkBucket,
      objectCount: objectRows.length,
      objects: objectRows.map((object) => ({
        created_at: object.created_at ?? null,
        metadata: object.metadata ?? null,
        name: object.name,
        updated_at: object.updated_at ?? null,
      })),
    },
  };

  writeFileSync(path.join(backupDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Backup written to ${backupDir}`);
  console.log(`Database dump: ${dumpFilePath}`);
  console.log(`Artwork objects backed up: ${objectRows.length}`);
}

async function restoreCommand() {
  const backupArg = readArg("backup");
  const yes = process.argv.includes("--yes") || process.argv.includes("--force");

  if (!yes) {
    throw new Error("Restore is destructive. Re-run with --yes to continue.");
  }

  const statusJson = parseStatusJson();
  const statusEnv = parseStatusEnv();
  const apiUrl = statusJson.API_URL;
  const serviceRoleKey = statusEnv.SECRET_KEY;

  if (!apiUrl || !serviceRoleKey) {
    throw new Error("Missing local Supabase API URL or service key.");
  }

  ensureLocalTarget(apiUrl, "restore");

  const backupDir = backupArg ? path.resolve(repoRoot, backupArg) : getLatestBackupDir();
  if (!backupDir || !existsSync(backupDir)) {
    throw new Error("No backup directory found. Run backup first or pass --backup <path>.");
  }

  const manifest = readManifest(backupDir);
  ensureLocalTarget(manifest.apiUrl ?? apiUrl, "restore backup");

  const dumpFilePath = path.join(backupDir, manifest.databaseDump ?? "database.sql");
  if (!existsSync(dumpFilePath)) {
    throw new Error(`Missing database dump: ${dumpFilePath}`);
  }

  const publicTables = queryRows(
    [
      "select table_name",
      "from information_schema.tables",
      "where table_schema = 'public' and table_type = 'BASE TABLE'",
      "order by table_name",
    ].join(" "),
    backupDir,
    "public-tables.sql",
  );

  const truncateTargets = [
    ...publicTables.map((row) => `public.${row.table_name}`),
  ];

  execSql(`truncate table ${truncateTargets.join(", ")} restart identity cascade;`, backupDir, "truncate-public.sql");
  execSql("delete from auth.identities;", backupDir, "delete-auth-identities.sql");
  execSql("delete from auth.users;", backupDir, "delete-auth-users.sql");
  await deleteArtworkFiles(apiUrl, serviceRoleKey, manifest.storage?.objects ?? []);
  const dumpStatements = splitSqlStatements(readFileSync(dumpFilePath, "utf8"));
  const restoredStatements = execSqlStatements(dumpStatements, backupDir, "restore-dump");

  const storageDir = path.join(backupDir, "storage", artworkBucket);
  const artworkObjects = manifest.storage?.objects ?? [];
  await uploadArtworkFiles(apiUrl, serviceRoleKey, artworkObjects, storageDir);

  console.log(`Restored backup from ${backupDir}`);
  console.log(`Database dump: ${dumpFilePath}`);
  console.log(`Artwork objects restored: ${artworkObjects.length}`);
  console.log(`SQL statements replayed: ${restoredStatements}`);
}

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  if (match) {
    return match.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1] ?? "";
  }

  return "";
}

async function main() {
  const command = process.argv[2];

  if (command === "backup") {
    await backupCommand();
    return;
  }

  if (command === "restore") {
    await restoreCommand();
    return;
  }

  console.log([
    "Usage:",
    "  node scripts/local-data-state.mjs backup",
    "  node scripts/local-data-state.mjs restore --yes [--backup <path>]",
    "",
    "Commands:",
    "  backup   Save local DB data plus content-artwork files into .local-backups/",
    "  restore  Restore a chosen backup back into the local Supabase instance",
    "",
    "Safety:",
    "  - Refuses non-local Supabase targets.",
    "  - Restore requires --yes (or --force).",
  ].join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
