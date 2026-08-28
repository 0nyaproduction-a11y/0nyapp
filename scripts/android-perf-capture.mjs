#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appJsonPath = join(repoRoot, "apps", "android", "app.json");

function readAndroidPackage() {
  const parsed = JSON.parse(readFileSync(appJsonPath, "utf8"));
  const packageName = parsed?.expo?.android?.package;
  if (!packageName || typeof packageName !== "string") {
    throw new Error(`Android package not found in ${appJsonPath}`);
  }
  return packageName;
}

function parseArgs(argv) {
  const args = {
    durationSeconds: 90,
    packageName: readAndroidPackage(),
    resetGfxinfo: false,
    runId: "",
    serial: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") args.runId = argv[++index] ?? "";
    else if (arg === "--duration") args.durationSeconds = Number(argv[++index] ?? args.durationSeconds);
    else if (arg === "--package") args.packageName = argv[++index] ?? args.packageName;
    else if (arg === "--serial") args.serial = argv[++index] ?? "";
    else if (arg === "--reset-gfxinfo") args.resetGfxinfo = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.runId.trim()) {
    throw new Error("Missing --run, for example --run P05-001");
  }
  if (!Number.isFinite(args.durationSeconds) || args.durationSeconds <= 0 || args.durationSeconds > 600) {
    throw new Error("--duration must be between 1 and 600 seconds");
  }

  args.runId = args.runId.trim();
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/android-perf-capture.mjs --run P05-001 [--duration 90] [--serial emulator-5554] [--reset-gfxinfo]

Captures bounded logcat plus gfxinfo/meminfo into perf/<run-id>/.
Set the same run ID in the Expo app with EXPO_PUBLIC_ONYA_PERF_RUN_ID=P05-001.`);
}

function adbArgs(args, command) {
  return args.serial ? ["-s", args.serial, ...command] : command;
}

function runAdb(args, command, options = {}) {
  const result = spawnSync("adb", adbArgs(args, command), {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

async function captureLogcat(args, outputPath) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath, { encoding: "utf8" });
    const child = spawn("adb", adbArgs(args, ["logcat", "-v", "threadtime"]));
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, args.durationSeconds * 1000);

    child.stdout.pipe(output);
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", reject);
    child.on("close", () => {
      clearTimeout(timeout);
      output.end(resolve);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = join(repoRoot, "perf", args.runId);
  mkdirSync(outputDir, { recursive: true });

  const devices = runAdb(args, ["devices"]);
  writeFileSync(join(outputDir, "devices.txt"), devices.stdout);
  if (!/\tdevice\b/.test(devices.stdout)) {
    throw new Error("No adb device in 'device' state. See perf run devices.txt.");
  }

  runAdb(args, ["logcat", "-c"]);

  if (args.resetGfxinfo) {
    runAdb(args, ["shell", "dumpsys", "gfxinfo", args.packageName, "reset"]);
  }

  await captureLogcat(args, join(outputDir, "logcat.txt"));

  const gfxinfo = runAdb(args, ["shell", "dumpsys", "gfxinfo", args.packageName]);
  writeFileSync(join(outputDir, "gfxinfo.txt"), gfxinfo.stdout || gfxinfo.stderr);

  const meminfo = runAdb(args, ["shell", "dumpsys", "meminfo", args.packageName]);
  writeFileSync(join(outputDir, "meminfo.txt"), meminfo.stdout || meminfo.stderr);

  const manifest = {
    capturedAt: new Date().toISOString(),
    durationSeconds: args.durationSeconds,
    packageName: args.packageName,
    resetGfxinfo: args.resetGfxinfo,
    runId: args.runId,
    serial: args.serial || null,
  };
  writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Captured Android perf run ${args.runId} in ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
