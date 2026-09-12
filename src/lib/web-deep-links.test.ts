import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import nextConfig from "../../next.config";

test("next.config.ts redirects singular /short-film/:slug to canonical /short-films/:slug", async () => {
  assert.ok(typeof nextConfig.redirects === "function", "nextConfig should define redirects()");
  const redirects = await nextConfig.redirects();
  const shortFilmRedirect = redirects.find((r) => r.source === "/short-film/:slug");
  assert.ok(shortFilmRedirect, "Should have redirect for /short-film/:slug");
  assert.equal(shortFilmRedirect.destination, "/short-films/:slug");
  assert.equal(shortFilmRedirect.permanent, true);
});

test("public/_redirects does not leak or proxy consumer routes to QA Cloud Run", () => {
  const redirectsPath = path.resolve(process.cwd(), "public/_redirects");
  assert.ok(fs.existsSync(redirectsPath), "public/_redirects must exist");
  const content = fs.readFileSync(redirectsPath, "utf8");

  assert.doesNotMatch(content, /https:\/\/onya-qa-api/, "Must not proxy public web routes to QA Cloud Run");
  assert.match(content, /\/short-film\/\*\s+\/short-films\/:splat\s+301/, "Must contain canonical short-film alias");
});

test("netlify.toml configures Netlify Next.js runtime without external QA proxying", () => {
  const tomlPath = path.resolve(process.cwd(), "netlify.toml");
  assert.ok(fs.existsSync(tomlPath), "netlify.toml must exist");
  const content = fs.readFileSync(tomlPath, "utf8");

  assert.doesNotMatch(content, /onya-qa-api/, "netlify.toml must not proxy to QA backend");
  assert.ok(content.includes("@netlify/plugin-nextjs"), "Must configure Netlify Next.js runtime plugin");
  assert.ok(content.includes('from = "/short-film/*"'));
  assert.ok(content.includes("status = 301"));
});

test("public/.well-known/assetlinks.json preserves canonical Android App Link configuration", () => {
  const assetlinksPath = path.resolve(process.cwd(), "public/.well-known/assetlinks.json");
  assert.ok(fs.existsSync(assetlinksPath), "assetlinks.json must exist in public/.well-known");
  const data = JSON.parse(fs.readFileSync(assetlinksPath, "utf8"));

  assert.ok(Array.isArray(data), "assetlinks should be an array");
  assert.equal(data[0]?.target?.package_name, "com.onya.app");
  assert.ok(
    data[0]?.target?.sha256_cert_fingerprints?.includes(
      "60:DA:32:D8:25:7B:E2:C5:0F:36:7A:02:41:3A:C8:DF:6A:45:95:C1:49:B8:E2:E2:E1:4E:3E:39:C3:08:FB:B6"
    ),
    "Fingerprint must match active certificate"
  );
});

