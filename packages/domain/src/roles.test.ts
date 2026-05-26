import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAccountType,
  normalizeRoles,
  rolesFromAccountType,
} from "./roles";

test("rolesFromAccountType maps UI account types", () => {
  assert.deepEqual(rolesFromAccountType("operator"), ["operator"]);
  assert.deepEqual(rolesFromAccountType("pilot"), ["pilot"]);
  assert.deepEqual(rolesFromAccountType("both"), ["operator", "pilot"]);
  assert.deepEqual(rolesFromAccountType("admin"), ["admin"]);
});

test("getAccountType derives UI account type from roles", () => {
  assert.equal(getAccountType(["operator"]), "operator");
  assert.equal(getAccountType(["pilot"]), "pilot");
  assert.equal(getAccountType(["operator", "pilot"]), "both");
  assert.equal(getAccountType(["admin"]), "admin");
  assert.equal(getAccountType(normalizeRoles(["operator", "pilot", "admin"])), "admin");
});
