import assert from "node:assert/strict";
import test from "node:test";
import { pilots, rankPilotsForRequest, requests, searchPilots } from "./index";

test("ranks the closest qualified G650 PIC first", () => {
  const matches = rankPilotsForRequest(requests[0], pilots);

  assert.equal(matches[0].pilotId, "pilot-001");
  assert.equal(matches[0].score, 100);
  assert.equal(matches[0].missingRequirements.length, 0);
});

test("filters pilots by aircraft type and rating", () => {
  const results = searchPilots(pilots, {
    aircraftType: "CL350",
    rating: "CL-350",
  });

  assert.deepEqual(
    results.map((pilot) => pilot.id),
    ["pilot-002"],
  );
});
