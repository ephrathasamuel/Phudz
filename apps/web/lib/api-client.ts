import type { ApiErrorResponse, CashoutRequest, CashoutRequestRecord } from "@phundz/shared";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = body as ApiErrorResponse;
    throw new ApiClientError(error.error?.message ?? "Request failed", error.error?.fields);
  }
  return body as T;
}

export function listCashoutRequests(): Promise<CashoutRequestRecord[]> {
  return fetch(`${apiBaseUrl}/api/cashout-requests`).then(parseResponse<CashoutRequestRecord[]>);
}

export function createCashoutRequest(input: CashoutRequest): Promise<CashoutRequestRecord> {
  return fetch(`${apiBaseUrl}/api/cashout-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(parseResponse<CashoutRequestRecord>);
}