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
    setHistory({ status: "loading" });
    try {
      setHistory({ status: "ready", requests: await listCashoutRequests() });
    } catch {
      setHistory({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { history, reload };
}
