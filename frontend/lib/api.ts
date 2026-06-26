/** Thin fetch wrapper for the FastAPI backend. Reads NEXT_PUBLIC_API_BASE_URL. */

import type {
  AdminActionResponse,
  AdminIncidentListResponse,
  IncidentDetail,
  IncidentListResponse,
  IncidentStatus,
  SubmitResponse,
} from "./types";

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Normalize base URL: strip trailing slash so `${BASE}/path` is well-formed.
const BASE = (RAW_BASE || "").replace(/\/+$/, "");

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Configuration error. Thrown when NEXT_PUBLIC_API_BASE_URL is missing,
 * which would otherwise produce a cryptic "Failed to parse URL" from
 * the platform fetch (Node 20 refuses relative URLs).
 */
class ApiConfigError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_API_BASE_URL is not set. Add it to frontend/.env.local " +
        "(e.g. NEXT_PUBLIC_API_BASE_URL=http://localhost:8000) and restart " +
        "the dev server.",
    );
    this.name = "ApiConfigError";
  }
}

function assertConfig() {
  // Empty BASE is allowed: it means "same origin" (relative /api/... URLs),
  // which the Next.js rewrite proxies to the backend. This is the supported
  // config when the browser and the API are on different hosts.
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  assertConfig();

  const { token, headers, ...rest } = init;
  const relPath = path.startsWith("/") ? path : `/${path}`;
  // Node's fetch refuses relative URLs, so on the server we have to build an
  // absolute URL ourselves. We point it at our own Next origin (same-origin
  // from inside the container) and rely on the rewrite to forward /api/* to
  // the backend. In the browser, BASE === "" means "same origin" — leave it
  // as a relative URL so the browser navigates to the Next server, which
  // applies the same rewrite.
  const isServer = typeof window === "undefined";
  const origin = isServer ? `http://localhost:${process.env.PORT || 3000}` : "";
  const url = BASE
    ? `${BASE}${relPath}`
    : `${origin}${relPath}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    });
  } catch (e: any) {
    // Surface a friendlier message for network / DNS / CORS failures.
    throw new ApiError(
      0,
      `Network error contacting ${BASE}: ${e?.message || e}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  submitIncident: (raw_text: string, title: string | undefined, email: string) =>
    request<SubmitResponse>("/api/incidents", {
      method: "POST",
      body: JSON.stringify({
        raw_text,
        title: title?.trim() || undefined,
        email: email.trim(),
      }),
    }),

  listIncidents: (page = 1, pageSize = 20) =>
    request<IncidentListResponse>(
      `/api/incidents?page=${page}&page_size=${pageSize}`,
    ),

  getIncident: (slug: string) =>
    request<IncidentDetail>(`/api/incidents/${slug}`),

  getStatus: (incidentId: string, email: string) =>
    request<IncidentStatus>(`/api/incidents/${incidentId}/status`, {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    }),

  // Admin
  listAdmin: (status: "pending" | "approved" | "rejected" | "archived" = "pending", page = 1, token: string) =>
    request<AdminIncidentListResponse>(
      `/api/admin/incidents?status=${status}&page=${page}`,
      { token },
    ),

  approve: (id: string, token: string) =>
    request<AdminActionResponse>(`/api/admin/incidents/${id}/approve`, {
      method: "POST",
      token,
    }),

  reject: (id: string, reason: string, token: string) =>
    request<AdminActionResponse>(`/api/admin/incidents/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      token,
    }),

  reopen: (id: string, token: string) =>
    request<AdminActionResponse>(`/api/admin/incidents/${id}/reopen`, {
      method: "POST",
      token,
    }),

  archive: (id: string, reason: string | null, token: string) =>
    request<AdminActionResponse>(`/api/admin/incidents/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || undefined }),
      token,
    }),

  unarchive: (id: string, token: string) =>
    request<AdminActionResponse>(`/api/admin/incidents/${id}/unarchive`, {
      method: "POST",
      token,
    }),

  regenerate: (id: string, promptOverride: string | null, token: string, model?: string | null) =>
    request<IncidentDetail>(`/api/admin/incidents/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({
        prompt_override: promptOverride,
        model: model || undefined,
      }),
      token,
    }),
};

export { ApiError, ApiConfigError };