import { test } from "node:test";
import assert from "node:assert/strict";
import { isSessionExpiry, notifySessionExpired, onSessionExpired } from "./sessionEvents.ts";

test("an authentication_required 401 on an account route is a session expiry", () => {
  assert.equal(isSessionExpiry("/api/progress", 401, "authentication_required"), true);
  assert.equal(isSessionExpiry("/api/attempts", 401, "authentication_required"), true);
  assert.equal(isSessionExpiry("/api/leaderboard?period=weekly", 401, "authentication_required"), true);
});

test("the startup identity check and auth routes never count as expiry", () => {
  assert.equal(isSessionExpiry("/api/me", 401, "authentication_required"), false);
  assert.equal(isSessionExpiry("/api/auth/login", 401, "invalid_credentials"), false);
  assert.equal(isSessionExpiry("/api/auth/logout", 401, "authentication_required"), false);
});

test("other errors are not session expiry", () => {
  assert.equal(isSessionExpiry("/api/progress", 403, "level_locked"), false);
  assert.equal(isSessionExpiry("/api/progress", 401, "invalid_credentials"), false);
  assert.equal(isSessionExpiry("/api/progress", 500, undefined), false);
});

test("listeners are notified until they unsubscribe", () => {
  let calls = 0;
  const unsubscribe = onSessionExpired(() => { calls += 1; });
  notifySessionExpired();
  assert.equal(calls, 1);
  unsubscribe();
  notifySessionExpired();
  assert.equal(calls, 1);
});
