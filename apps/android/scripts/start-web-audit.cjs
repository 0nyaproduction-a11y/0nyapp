#!/usr/bin/env node
"use strict";

/**
 * TEMPORARY LOCAL DEV-ONLY WEB AUDIT LAUNCH GUARD.
 *
 * Purpose: prevent the exact API HTML-contamination regression observed in the
 * web audit: an API request that goes to the APP tunnel (Expo/Metro dev
 * server) instead of the API PROXY tunnel gets Metro's SPA/history fallback
 * answered with `200 text/html <!DOCTYPE html>...`, which the app's
 * `response.json()` then fails to parse.
 *
 * This guard health-checks the API base URL BEFORE Expo starts and refuses to
 * launch (or passes --check-only) unless `/api/v1/catalog` returns real JSON:
 * - HTTP 200
 * - Content-Type application/json
 * - body parses as JSON
 * If HTML is returned, it prints a loud diagnosis (APP tunnel / website host
 * misroute) and exits non-zero so the wrong URL can never be silently bundled
 * into the web audit harness again.
 *
 * This script does NOT:
 * - mock or fabricate any API response
 * - change the API client, app code, backend, or Android app
 * - run in, or ship to, the Android native app
 *
 * It only exists for the local web-audit session. It is safe to delete.
 *
 * Usage:
 *   node scripts/start-web-audit.cjs --api-base https://<API-PROXY-TUNNEL>.trycloudflare.com [--check-only] [extra expo args]
 *   (--api-base defaults to EXPO_PUBLIC_ONYA_API_BASE_URL when set)
 *   Optional: --web-audit-proxy-url <URL> validates and sets
 *   EXPO_PUBLIC_ONYA_WEB_AUDIT_PROXY_URL (web-only CORS proxy override).
 */

const { spawn } = require("child_process");
const path = require("path");

function fail(message) {
  console.error("[web-audit] BLOCKED: " + message);
  process.exit(1);
}

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseArgs(argv) {
  const args = {
    apiBase: undefined,
    webAuditProxyUrl: undefined,
    checkOnly: false,
    expoArgs: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api-base") {
      args.apiBase = argv[(i += 1)];
    } else if (arg === "--web-audit-proxy-url") {
      args.webAuditProxyUrl = argv[(i += 1)];
    } else if (arg === "--check-only") {
      args.checkOnly = true;
    } else {
      args.expoArgs.push(arg);
    }
  }

  return args;
}

async function checkApiBase(label, base) {
  const url = `${base}/api/v1/catalog`;
  let response;

  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (error) {
    fail(
      `${label} ${base} is unreachable for ${url} (${
        error && error.message ? error.message : String(error)
      }). Refusing to start the web audit on a dead or wrong tunnel URL.`,
    );
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  const head = text.slice(0, 80).replace(/[^\x20-\x7E]/g, ".");

  if (contentType.includes("text/html") || /^\s*(<!doctype|<html)/i.test(text)) {
    fail(
      `${label} ${base} returned HTML for /api/v1/catalog (status ${response.status}, ` +
        `content-type ${contentType || "none"}, first chars: "${head}"). This is the APP ` +
        `tunnel / a website host, not the QA API. Point the API base at the API PROXY ` +
        `tunnel (cloudflared -> 127.0.0.1:8788) or the approved Cloud Run QA URL.`,
    );
  }

  if (response.status !== 200) {
    fail(`${label} ${base} returned status ${response.status} for /api/v1/catalog.`);
  }

  if (!contentType.includes("application/json")) {
    fail(
      `${label} ${base} returned non-JSON content-type for /api/v1/catalog: ${
        contentType || "none"
      } (status ${response.status}).`,
    );
  }

  try {
    JSON.parse(text);
  } catch (error) {
    fail(
      `${label} ${base} returned unparseable JSON for /api/v1/catalog (${
        error && error.message ? error.message : String(error)
      }). First chars: "${head}"`,
    );
  }

  console.log(`[web-audit] ${label} OK: ${base} (200, application/json, valid JSON)`);
}

(async () => {
  const args = parseArgs(process.argv);
  const apiBase = normalizeBase(args.apiBase || process.env.EXPO_PUBLIC_ONYA_API_BASE_URL);

  if (!apiBase) {
    fail(
      "No API base URL provided. Pass --api-base <URL> (the API PROXY tunnel or Cloud Run QA URL) or set EXPO_PUBLIC_ONYA_API_BASE_URL.",
    );
  }

  if (!/^https?:\/\//i.test(apiBase)) {
    fail(`API base must be an absolute http(s) URL, got: ${apiBase}`);
  }

  await checkApiBase("API base", apiBase);

  if (args.webAuditProxyUrl) {
    const proxyUrl = normalizeBase(args.webAuditProxyUrl);
    await checkApiBase("Web audit proxy", proxyUrl);
    process.env.EXPO_PUBLIC_ONYA_WEB_AUDIT_PROXY_URL = proxyUrl;
  }

  process.env.EXPO_PUBLIC_ONYA_API_BASE_URL = apiBase;

  if (args.checkOnly) {
    console.log("[web-audit] --check-only: validation passed. Expo not started.");
    return;
  }

  console.log(
    `[web-audit] starting Expo web (bundled API base = ${apiBase}${
      args.webAuditProxyUrl ? `, web audit proxy = ${normalizeBase(args.webAuditProxyUrl)}` : ""
    }) ...`,
  );

  const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["expo", "start", "--web", ...args.expoArgs], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code) => process.exit(typeof code === "number" ? code : 1));
})().catch((error) => fail(error && error.message ? error.message : String(error)));