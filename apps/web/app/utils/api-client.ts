import { fetchAuthSession } from "aws-amplify/auth";
import type {
  AccountType,
  OperatorProfile,
  PilotMatch,
  PilotProfile,
  StaffingRequest,
  UserAccount,
} from "@crewlink/domain";

export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_HTTP_API_URL ?? "";
  try {
    const cdkOutputs = require("@root/cdk-outputs.json") as {
      custom?: { httpApiUrl?: string };
    };
    const raw = cdkOutputs.custom?.httpApiUrl || fromEnv;
    return raw ? (raw.endsWith("/") ? raw : `${raw}/`) : "";
  } catch {
    return fromEnv ? (fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`) : "";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token =
    session.tokens?.idToken?.toString() ||
    session.tokens?.accessToken?.toString();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("CrewLinkAI API URL is not configured.");
  const headers = await authHeaders();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || response.statusText);
  }
  return data as T;
}

export function postContact(body: Record<string, string>) {
  return requestJson<{ ok: boolean; id: string }>("contact", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createContact(input: {
  name: string;
  email: string;
  organization?: string;
  message?: string;
}) {
  return postContact({
    name: input.name,
    email: input.email,
    ...(input.organization ? { organization: input.organization } : {}),
    ...(input.message ? { message: input.message } : {}),
  });
}

export function subscribeNewsletter(email: string) {
  return postContact({
    source: "newsletter",
    email,
  });
}

export function listPilots(query = "") {
  return requestJson<{ pilots: PilotProfile[] }>(`pilots${query}`);
}

export function listRequests() {
  return requestJson<{ requests: StaffingRequest[] }>("requests");
}

export async function loadOperatorProfile(): Promise<OperatorProfile | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("CrewLinkAI API URL is not configured.");

  const headers = await authHeaders();
  const response = await fetch(`${baseUrl}operator-profile`, { headers });
  if (response.status === 404) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || response.statusText);
  }
  return (data as { profile: OperatorProfile }).profile;
}

export function saveOperatorProfile(input: Partial<OperatorProfile>) {
  return requestJson<{ profile: OperatorProfile }>("operator-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function loadPilotProfile(): Promise<PilotProfile | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("CrewLinkAI API URL is not configured.");

  const headers = await authHeaders();
  const response = await fetch(`${baseUrl}pilot-profile`, { headers });
  if (response.status === 404) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || response.statusText);
  }
  return (data as { profile: PilotProfile }).profile;
}

export function savePilotProfile(input: Partial<PilotProfile>) {
  return requestJson<{ profile: PilotProfile }>("pilot-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function loadAccount(): Promise<{
  account: UserAccount;
  accountType: AccountType;
} | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("CrewLinkAI API URL is not configured.");

  const headers = await authHeaders();
  const response = await fetch(`${baseUrl}account`, { headers });
  if (response.status === 404) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || response.statusText);
  }
  return data as { account: UserAccount; accountType: AccountType };
}

export function saveAccountType(accountType: AccountType) {
  return requestJson<{ account: UserAccount; accountType: AccountType }>("account", {
    method: "PUT",
    body: JSON.stringify({ accountType }),
  });
}

export function createStaffingRequest(input: Partial<StaffingRequest>) {
  return requestJson<{ request: StaffingRequest }>("requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateStaffingRequest(id: string, input: Partial<StaffingRequest>) {
  return requestJson<{ request: StaffingRequest }>("requests", {
    method: "PUT",
    body: JSON.stringify({ ...input, id }),
  });
}

export function getMatches(requestId: string) {
  return requestJson<{ request: StaffingRequest; matches: PilotMatch[] }>(
    `matches?requestId=${encodeURIComponent(requestId)}`,
  );
}

export function getMapData() {
  return requestJson<{
    pilots: PilotProfile[];
    requests: StaffingRequest[];
  }>("map");
}
