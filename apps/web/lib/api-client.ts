import type { ApiErrorBody, CashoutRequest, CashoutRequestRecord } from "@phundz/shared";

// Must be referenced literally so Next.js inlines it into the browser bundle.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the server could not be reached. */
    public readonly status: number,
    public readonly code: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0, "NETWORK_ERROR");
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body.error.message, response.status, body.error.code, body.error.fields);
    }
    throw new ApiError("Something went wrong. Please try again.", response.status, "UNKNOWN_ERROR");
  }
  return body as T;
}

export function listCashoutRequests(limit?: number): Promise<CashoutRequestRecord[]> {
  const query = limit === undefined ? "" : `?limit=${encodeURIComponent(limit)}`;
  return request<CashoutRequestRecord[]>(`/api/cashout-requests${query}`);
}

export function createCashoutRequest(input: CashoutRequest): Promise<CashoutRequestRecord> {
  return request<CashoutRequestRecord>("/api/cashout-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
