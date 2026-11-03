import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("PWA manifest has a standalone PT installation target and icon", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "pt-PT");
  assert.ok(manifest.icons.some((icon) => icon.src === "/icons/icon-192.png" && icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.src === "/icons/icon-512.png" && icon.purpose.includes("maskable")));
});

test("offline service worker falls back to the offline page without caching app data", async () => {
  const source = await read("public/sw.js");
  const listeners = {};
  const offlinePage = { status: 200, text: "offline" };
  const context = {
    URL,
    self: { location: { origin: "https://vending.example" }, addEventListener: (name, fn) => { listeners[name] = fn; }, skipWaiting() {}, clients: { claim() {} } },
    caches: { match: async (key) => key === "/offline.html" ? offlinePage : undefined },
    fetch: async () => { throw new Error("offline"); },
  };
  vm.runInNewContext(source, context);
  let responsePromise;
  listeners.fetch({ request: { method: "GET", mode: "navigate", url: "https://vending.example/dashboard" }, respondWith: (promise) => { responsePromise = promise; } });
  assert.equal(await responsePromise, offlinePage);
  responsePromise = undefined;
  listeners.fetch({ request: { method: "GET", mode: "cors", url: "https://vending.example/rest/v1/sales" }, respondWith: (promise) => { responsePromise = promise; } });
  assert.equal(responsePromise, undefined, "API and data requests must never be served from or added to cache");
});

test("production response headers include browser security protections", async () => {
  const config = await read("next.config.ts");
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(config.includes(header), `missing ${header}`);
  }
  assert.ok(config.includes("frame-ancestors 'none'"));
  assert.ok(config.includes("object-src 'none'"));
});
