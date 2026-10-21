import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalRedirect } from "./safeRedirect";

test("authentication redirects preserve valid internal paths", () => {
  assert.equal(
    safeInternalRedirect("/dashboard/bookings?status=pending#results"),
    "/dashboard/bookings?status=pending#results",
  );
});

test("authentication redirects reject external and ambiguous targets", () => {
  for (const target of [
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/\\attacker.example/steal",
    "javascript:alert(1)",
    " dashboard",
    "/dashboard\n//attacker.example",
    null,
  ]) {
    assert.equal(safeInternalRedirect(target), "/dashboard", String(target));
  }
});
