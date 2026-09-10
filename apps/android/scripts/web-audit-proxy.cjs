#!/usr/bin/env node
"use strict";

/**
 * TEMPORARY LOCAL DEV-ONLY WEB AUDIT PROXY BRIDGE.
 *
 * Purpose: let the temporary Expo Web audit harness (running in a browser)
 * reach the REAL Cloud Run QA API without being blocked by browser CORS.
 *
 * How it works: the browser calls this local proxy (server-to-server
 * requests are not subject to CORS), which forwards every request byte-for-
 * byte to the real QA API and streams the real response back, adding CORS
 * headers ONLY for an explicit local-dev origin allowlist.
 *
 * This proxy does NOT:
 * - mock or fabricate any API response, catalog, entitlement, or wallet data
 * - bypass backend authentication (Authorization headers are forwarded as-is)
 * - grant Coins / Plus / rewarded access
 * - run in, or ship to, the Android native app
 * - touch production/QA data
 *
 * It only exists for this local web-audit session. It is safe to delete.
 *
 * Usage: node scripts/web-audit-proxy.cjs
 * (binds to 127.0.0.1 only; never exposed beyond localhost)
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const TARGET_ORIGIN =
  process.env.WEB_AUDIT_PROXY_TARGET || "https://onya-qa-api-gwkke6nq5a-el.a.run.app";
const LISTEN_PORT = Number(process.env.WEB_AUDIT_PROXY_PORT || 8788);
const LISTEN_HOST = "127.0.0.1";

const ALLOWED_ORIGINS = new Set(
  (
    process.env.WEB_AUDIT_PROXY_ALLOWED_ORIGINS ||
    "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006,http://localhost:8082,http://127.0.0.1:8082"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const target = new URL(TARGET_ORIGIN);

function applyCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,accept");
  res.setHeader("Access-Control-Max-Age", "600");
}

const server = http.createServer((req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const chunks = [];

  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const forwardHeaders = { ...req.headers };
    delete forwardHeaders.host;
    delete forwardHeaders.origin;
    delete forwardHeaders.referer;
    delete forwardHeaders["content-length"];

    const proxyReq = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: req.url,
        method: req.method,
        headers: {
          ...forwardHeaders,
          host: target.hostname,
        },
      },
      (proxyRes) => {
        const requestPath = (req.url || "").split("?")[0] || "";
        const upstreamContentType = String(proxyRes.headers["content-type"] || "").toLowerCase();

        // Tripwire (report-only, never alters the response): if the upstream
        // target ever answers an /api path with HTML, the target is almost
        // certainly the APP tunnel / a website host instead of the QA API.
        // Log it loudly instead of silently forwarding HTML that the browser
        // would fail to parse as JSON.
        if (requestPath.startsWith("/api/") && upstreamContentType.includes("text/html")) {
          console.error(
            `[web-audit-proxy] WARNING: upstream returned text/html for API path ` +
              `${req.method} ${requestPath} (status ${proxyRes.statusCode}). ` +
              `WEB_AUDIT_PROXY_TARGET (${TARGET_ORIGIN}) is likely the APP tunnel or a ` +
              `website host, not the QA API. Response forwarded unchanged.`,
          );
        }

        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", (err) => {
      console.error("[web-audit-proxy] upstream error:", err.message);

      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }

      res.end(JSON.stringify({ error: { code: "proxy_upstream_error", message: err.message } }));
    });

    if (body) {
      proxyReq.write(body);
    }

    proxyReq.end();
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[web-audit-proxy] listening on http://${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET_ORIGIN}`);
  console.log(`[web-audit-proxy] allowed browser origins: ${[...ALLOWED_ORIGINS].join(", ")}`);
});
