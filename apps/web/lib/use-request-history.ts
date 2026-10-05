"use client";

import { useCallback, useEffect, useState } from "react";
import type { CashoutRequestRecord } from "@phundz/shared";
import { listCashoutRequests } from "./api-client";

export type RequestHistory =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; requests: CashoutRequestRecord[] };

export function useRequestHistory() {
  const [history, setHistory] = useState<RequestHistory>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      const requests = await listCashoutRequests();
      setHistory({ status: "ready", requests });
    } catch {
      setHistory((curr) => (curr.status === "ready" ? curr : { status: "error" }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Auto-poll every 2.5s if any request is currently pending or processing
  useEffect(() => {
    if (history.status !== "ready") return;
    const hasActive = history.requests.some(
      (r) => r.status === "pending" || r.status === "processing",
    );
    if (!hasActive) return;

    const interval = setInterval(() => {
      void reload();
    }, 2500);

    return () => clearInterval(interval);
  }, [history, reload]);

  return { history, reload };
}
