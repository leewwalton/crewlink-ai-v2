import assert from "node:assert/strict";
import test from "node:test";
import {
  rankPilotsForRequest,
  searchPilots,
  type PilotProfile,
  type StaffingRequest,
} from "./index";

const sampleRequest: StaffingRequest = {
  id: "req-test",
  operatorId: "op-test",
  title: "G650 PIC for TEB rotation",
  aircraftType: "G650",
  requiredTypeRatings: ["G-VI"],
  requiredCertificates: ["ATP"],
  requiredRole: "PIC",
  departureAirport: "KTEB",
  location: {
    id: "loc-req-test",
    label: "Teterboro",
    latitude: 40.8501,
    longitude: -74.0608,
    sourceTimestamp: "2026-05-13T14:10:00Z",
    precision: "airport",
  },
  startDate: "2026-05-18",
  endDate: "2026-05-21",
  minimumTotalTime: 5000,
  minimumPicTime: 2500,
  tripNotes: "International procedures experience required.",
  urgency: "urgent",
  compensationVisibility: "range",
  status: "open",
};

const samplePilots: PilotProfile[] = [
  {
    id: "pilot-001",
    name: "Avery Collins",
    email: "avery@example.com",
    phone: "+1 555-0101",
    role: "PIC",
    homeBase: "KTEB",
    currentLocation: {
      id: "loc-pilot-001",
      label: "Teterboro",
      latitude: 40.8501,
      longitude: -74.0608,
      sourceTimestamp: "2026-05-13T14:00:00Z",
      precision: "airport",
    },
    aircraftTypes: ["G650", "G550", "GV"],
    typeRatings: ["G-VI", "G-V"],
    certificates: ["ATP", "Part 135"],
    medicalClass: "First",
    totalTime: 8450,
    picTime: 5100,
    sicTime: 2100,
    documentsStatus: "verified",
    availability: [{ startDate: "2026-05-14", endDate: "2026-05-21", status: "available" }],
    contractPreference: "contract",
    travelRegions: ["North America"],
    lastActive: "2026-05-13T13:42:00Z",
  },
  {
    id: "pilot-002",
    name: "Jordan Patel",
    email: "jordan@example.com",
    role: "SIC",
    homeBase: "KDAL",
    currentLocation: {
      id: "loc-pilot-002",
      label: "Dallas Love",
      latitude: 32.8471,
      longitude: -96.8518,
      sourceTimestamp: "2026-05-13T13:30:00Z",
      precision: "airport",
    },
    aircraftTypes: ["CL350", "CL300", "G280"],
    typeRatings: ["CL-350", "CL-300"],
    certificates: ["ATP", "RVSM"],
    medicalClass: "First",
    totalTime: 4620,
    picTime: 1300,
    sicTime: 2600,
    documentsStatus: "verified",
    availability: [{ startDate: "2026-05-16", endDate: "2026-05-24", status: "standby" }],
    contractPreference: "either",
    travelRegions: ["North America"],
    lastActive: "2026-05-13T12:50:00Z",
  },
];

test("ranks the closest qualified G650 PIC first", () => {
  const matches = rankPilotsForRequest(sampleRequest, samplePilots);

  assert.equal(matches[0].pilotId, "pilot-001");
  assert.equal(matches[0].score, 100);
  assert.equal(matches[0].missingRequirements.length, 0);
});

test("filters pilots by aircraft type and rating", () => {
  const results = searchPilots(samplePilots, {
    aircraftType: "CL350",
    rating: "CL-350",
  });

  assert.deepEqual(
    results.map((pilot) => pilot.id),
    ["pilot-002"],
  );
});
