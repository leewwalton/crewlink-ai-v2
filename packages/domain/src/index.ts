export type AccountRole = "operator" | "pilot" | "admin";
export type PilotRole = "PIC" | "SIC" | "Relief Pilot";
export type StaffingRequestStatus = "draft" | "open" | "reviewing" | "filled" | "cancelled";
export type MatchAction = "new" | "shortlist" | "contacted" | "declined";

export interface LocationSnapshot {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  sourceTimestamp: string;
  precision: "exact" | "airport" | "metro";
}

export interface AvailabilityWindow {
  startDate: string;
  endDate: string;
  status: "available" | "standby" | "limited";
}

export interface PilotProfile {
  id: string;
  name: string;
  role: PilotRole;
  homeBase: string;
  currentLocation: LocationSnapshot;
  aircraftTypes: string[];
  typeRatings: string[];
  certificates: string[];
  medicalClass: "First" | "Second" | "Third";
  totalTime: number;
  picTime: number;
  sicTime: number;
  documentsStatus: "verified" | "review" | "expired";
  availability: AvailabilityWindow[];
  contractPreference: "contract" | "full-time" | "either";
  travelRegions: string[];
  hourlyRate?: number;
  lastActive: string;
}

export interface OperatorProfile {
  id: string;
  organization: string;
  contactName: string;
  email: string;
  fleetTypes: string[];
  operatingRegions: string[];
  status: "active" | "trial" | "inactive";
}

export interface StaffingRequest {
  id: string;
  operatorId: string;
  title: string;
  aircraftType: string;
  requiredTypeRatings: string[];
  requiredCertificates: string[];
  requiredRole: PilotRole;
  departureAirport: string;
  arrivalAirport?: string;
  location: LocationSnapshot;
  startDate: string;
  endDate: string;
  minimumTotalTime: number;
  minimumPicTime?: number;
  tripNotes: string;
  urgency: "standard" | "urgent" | "instant";
  compensationVisibility: "hidden" | "range" | "fixed";
  status: StaffingRequestStatus;
}

export interface MatchFactor {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface PilotMatch {
  id: string;
  requestId: string;
  pilotId: string;
  score: number;
  distanceNm: number;
  factors: MatchFactor[];
  missingRequirements: string[];
  explanation: string;
  action: MatchAction;
}

export interface MarketplaceSnapshot {
  pilots: PilotProfile[];
  operators: OperatorProfile[];
  requests: StaffingRequest[];
}

export const operators: OperatorProfile[] = [
  {
    id: "op-001",
    organization: "Northstar Jet Management",
    contactName: "Morgan Reeves",
    email: "ops@northstar.example",
    fleetTypes: ["G650", "CL350", "PC-24"],
    operatingRegions: ["North America", "Caribbean"],
    status: "trial",
  },
];

export const pilots: PilotProfile[] = [
  {
    id: "pilot-001",
    name: "Avery Collins",
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
    certificates: ["ATP", "Part 135", "International Procedures"],
    medicalClass: "First",
    totalTime: 8450,
    picTime: 5100,
    sicTime: 2100,
    documentsStatus: "verified",
    availability: [{ startDate: "2026-05-14", endDate: "2026-05-21", status: "available" }],
    contractPreference: "contract",
    travelRegions: ["North America", "Europe", "Caribbean"],
    hourlyRate: 225,
    lastActive: "2026-05-13T13:42:00Z",
  },
  {
    id: "pilot-002",
    name: "Jordan Patel",
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
    hourlyRate: 145,
    lastActive: "2026-05-13T12:50:00Z",
  },
  {
    id: "pilot-003",
    name: "Samira Brooks",
    role: "PIC",
    homeBase: "KPBI",
    currentLocation: {
      id: "loc-pilot-003",
      label: "Palm Beach",
      latitude: 26.6832,
      longitude: -80.0956,
      sourceTimestamp: "2026-05-13T12:15:00Z",
      precision: "metro",
    },
    aircraftTypes: ["PC-24", "PC-12", "Phenom 300"],
    typeRatings: ["PC-24", "EMB-505"],
    certificates: ["ATP", "Part 135", "International Procedures"],
    medicalClass: "First",
    totalTime: 6900,
    picTime: 4200,
    sicTime: 900,
    documentsStatus: "review",
    availability: [{ startDate: "2026-05-13", endDate: "2026-05-18", status: "limited" }],
    contractPreference: "contract",
    travelRegions: ["North America", "Caribbean", "Central America"],
    hourlyRate: 190,
    lastActive: "2026-05-13T11:10:00Z",
  },
  {
    id: "pilot-004",
    name: "Elliot Ramirez",
    role: "PIC",
    homeBase: "KVNY",
    currentLocation: {
      id: "loc-pilot-004",
      label: "Van Nuys",
      latitude: 34.2098,
      longitude: -118.4899,
      sourceTimestamp: "2026-05-13T10:55:00Z",
      precision: "airport",
    },
    aircraftTypes: ["G650", "Global 7500", "G600"],
    typeRatings: ["G-VI", "BD-700"],
    certificates: ["ATP", "Part 91K", "International Procedures"],
    medicalClass: "First",
    totalTime: 10120,
    picTime: 7200,
    sicTime: 1300,
    documentsStatus: "verified",
    availability: [{ startDate: "2026-05-18", endDate: "2026-05-29", status: "available" }],
    contractPreference: "either",
    travelRegions: ["North America", "Europe", "Asia"],
    hourlyRate: 250,
    lastActive: "2026-05-13T09:35:00Z",
  },
];

export const requests: StaffingRequest[] = [
  {
    id: "req-001",
    operatorId: "op-001",
    title: "G650 PIC for TEB to LTN rotation",
    aircraftType: "G650",
    requiredTypeRatings: ["G-VI"],
    requiredCertificates: ["ATP", "International Procedures"],
    requiredRole: "PIC",
    departureAirport: "KTEB",
    arrivalAirport: "EGGW",
    location: {
      id: "loc-req-001",
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
    tripNotes: "International procedures experience required. Crew rest arranged in London.",
    urgency: "urgent",
    compensationVisibility: "range",
    status: "open",
  },
  {
    id: "req-002",
    operatorId: "op-001",
    title: "CL350 SIC standby coverage",
    aircraftType: "CL350",
    requiredTypeRatings: ["CL-350"],
    requiredCertificates: ["ATP"],
    requiredRole: "SIC",
    departureAirport: "KDAL",
    location: {
      id: "loc-req-002",
      label: "Dallas Love",
      latitude: 32.8471,
      longitude: -96.8518,
      sourceTimestamp: "2026-05-13T14:08:00Z",
      precision: "airport",
    },
    startDate: "2026-05-17",
    endDate: "2026-05-20",
    minimumTotalTime: 2500,
    tripNotes: "Standby window for short-notice owner trips.",
    urgency: "instant",
    compensationVisibility: "fixed",
    status: "open",
  },
];

export const marketplaceSnapshot: MarketplaceSnapshot = {
  pilots,
  operators,
  requests,
};

function dateRangeOverlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd);
}

export function distanceNm(a: LocationSnapshot, b: LocationSnapshot): number {
  const radiusNm = 3440.065;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * radiusNm * Math.asin(Math.sqrt(h)));
}

export function scorePilotForRequest(pilot: PilotProfile, request: StaffingRequest): PilotMatch {
  const missingRequirements: string[] = [];
  const factors: MatchFactor[] = [];

  const aircraftFit = pilot.aircraftTypes.includes(request.aircraftType) ? 20 : 0;
  const missingRatings = request.requiredTypeRatings.filter(
    (rating) => !pilot.typeRatings.includes(rating),
  );
  const ratingFit = missingRatings.length === 0 ? 20 : 0;
  const missingCertificates = request.requiredCertificates.filter(
    (certificate) => !pilot.certificates.includes(certificate),
  );
  const certificateFit =
    request.requiredCertificates.length === 0
      ? 10
      : Math.round(
          ((request.requiredCertificates.length - missingCertificates.length) /
            request.requiredCertificates.length) *
            10,
        );
  const roleFit = pilot.role === request.requiredRole ? 10 : 4;
  const docsFit = pilot.documentsStatus === "verified" ? 10 : pilot.documentsStatus === "review" ? 5 : 0;
  const qualificationScore = aircraftFit + ratingFit + certificateFit + roleFit + docsFit;

  if (!aircraftFit) missingRequirements.push(`Aircraft experience: ${request.aircraftType}`);
  missingRequirements.push(...missingRatings.map((rating) => `Type rating: ${rating}`));
  missingRequirements.push(...missingCertificates.map((certificate) => `Certificate: ${certificate}`));
  if (pilot.documentsStatus !== "verified") {
    missingRequirements.push("Document verification requires review");
  }

  factors.push({
    label: "Qualifications",
    score: qualificationScore,
    maxScore: 70,
    detail: `${pilot.name} matches ${qualificationScore} of 70 qualification points.`,
  });

  const availabilityWindow = pilot.availability.find((window) =>
    dateRangeOverlaps(window.startDate, window.endDate, request.startDate, request.endDate),
  );
  const availabilityScore =
    availabilityWindow?.status === "available"
      ? 15
      : availabilityWindow?.status === "standby"
        ? 12
        : availabilityWindow?.status === "limited"
          ? 7
          : 0;
  if (!availabilityWindow) missingRequirements.push("Availability window");
  factors.push({
    label: "Availability",
    score: availabilityScore,
    maxScore: 15,
    detail: availabilityWindow
      ? `${availabilityWindow.status} from ${availabilityWindow.startDate} to ${availabilityWindow.endDate}.`
      : "No overlapping availability window.",
  });

  const distance = distanceNm(pilot.currentLocation, request.location);
  const proximityScore = distance < 100 ? 10 : distance < 500 ? 7 : distance < 1500 ? 4 : 1;
  factors.push({
    label: "Proximity",
    score: proximityScore,
    maxScore: 10,
    detail: `${distance} NM from ${request.departureAirport}.`,
  });

  const experienceScore =
    pilot.totalTime >= request.minimumTotalTime &&
    (request.minimumPicTime == null || pilot.picTime >= request.minimumPicTime)
      ? 5
      : 2;
  if (pilot.totalTime < request.minimumTotalTime) {
    missingRequirements.push(`Minimum total time: ${request.minimumTotalTime}`);
  }
  if (request.minimumPicTime != null && pilot.picTime < request.minimumPicTime) {
    missingRequirements.push(`Minimum PIC time: ${request.minimumPicTime}`);
  }
  factors.push({
    label: "Experience",
    score: experienceScore,
    maxScore: 5,
    detail: `${pilot.totalTime.toLocaleString()} total hours and ${pilot.picTime.toLocaleString()} PIC hours.`,
  });

  const score = Math.min(
    100,
    qualificationScore + availabilityScore + proximityScore + experienceScore,
  );
  const strongest = [...factors].sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)[0];

  return {
    id: `${request.id}-${pilot.id}`,
    requestId: request.id,
    pilotId: pilot.id,
    score,
    distanceNm: distance,
    factors,
    missingRequirements,
    explanation: `${pilot.name} is a ${score}% fit for ${request.title}. ${strongest.detail}`,
    action: "new",
  };
}

export function rankPilotsForRequest(
  request: StaffingRequest,
  candidatePilots: PilotProfile[] = pilots,
): PilotMatch[] {
  return candidatePilots
    .map((pilot) => scorePilotForRequest(pilot, request))
    .sort((a, b) => b.score - a.score || a.distanceNm - b.distanceNm);
}

export function searchPilots(
  candidatePilots: PilotProfile[],
  query: {
    aircraftType?: string;
    rating?: string;
    certificate?: string;
    availableStart?: string;
    availableEnd?: string;
    contractPreference?: PilotProfile["contractPreference"];
    maxDistanceNm?: number;
    origin?: LocationSnapshot;
  },
): PilotProfile[] {
  return candidatePilots.filter((pilot) => {
    if (query.aircraftType && !pilot.aircraftTypes.includes(query.aircraftType)) return false;
    if (query.rating && !pilot.typeRatings.includes(query.rating)) return false;
    if (query.certificate && !pilot.certificates.includes(query.certificate)) return false;
    if (
      query.contractPreference &&
      pilot.contractPreference !== "either" &&
      pilot.contractPreference !== query.contractPreference
    ) {
      return false;
    }
    if (query.availableStart && query.availableEnd) {
      const available = pilot.availability.some((window) =>
        dateRangeOverlaps(window.startDate, window.endDate, query.availableStart!, query.availableEnd!),
      );
      if (!available) return false;
    }
    if (query.origin && query.maxDistanceNm != null) {
      return distanceNm(pilot.currentLocation, query.origin) <= query.maxDistanceNm;
    }
    return true;
  });
}

export * from "./messaging";
