import assert from "node:assert/strict";
import test from "node:test";
import { resolveServerBaseUrl } from "@/features/keystone/lib/server-base-url";

test("server base URL uses a trusted configured production origin", () => {
  assert.equal(
    resolveServerBaseUrl({ NODE_ENV: "production", APP_BASE_URL: "https://airline.example" }),
    "https://airline.example",
  );
  assert.equal(
    resolveServerBaseUrl({ NODE_ENV: "production", VERCEL_URL: "airline.vercel.app" }),
    "https://airline.vercel.app",
  );
});

test("server base URL uses loopback in development instead of request headers", () => {
  assert.equal(
    resolveServerBaseUrl({
      NODE_ENV: "development",
      PORT: "4317",
      HOST: "attacker.example",
      X_FORWARDED_HOST: "attacker.example",
    }),
    "http://127.0.0.1:4317",
  );
});

test("server base URL fails closed for malformed or missing production origins", () => {
  assert.throws(
    () => resolveServerBaseUrl({ NODE_ENV: "production" }),
    /APP_BASE_URL is required/,
  );
  for (const value of [
    "//attacker.example",
    "javascript:alert(1)",
    "https://user:pass@airline.example",
    "https://airline.example/internal",
  ]) {
    assert.throws(
      () => resolveServerBaseUrl({ NODE_ENV: "production", APP_BASE_URL: value }),
      /trusted http\(s\) origin|absolute http\(s\) URL/,
    );
  }
});
