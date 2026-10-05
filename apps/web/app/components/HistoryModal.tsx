"use client";

import { useEffect, useMemo, useState } from "react";
import type { CashoutRequestRecord, DatePreset, DepositRecord } from "@phundz/shared";
import { formatAmount, formatDateTime, maskPhone } from "../../lib/format";
import styles from "../page.module.css";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: CashoutRequestRecord[];
  deposits: DepositRecord[];
}

function toLocalDateString(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinDays(isoString: string, days: number): boolean {
  const itemTime = new Date(isoString).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return itemTime >= cutoff;
}

export function HistoryModal({ isOpen, onClose, requests, deposits }: HistoryModalProps) {
  const [preset, setPreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState<string>("");

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const todayStr = useMemo(() => toLocalDateString(new Date().toISOString()), []);
  const yesterdayStr = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return toLocalDateString(yesterday.toISOString());
  }, []);

  function matchesDateFilter(isoString: string): boolean {
    if (preset === "all") return true;
    if (preset === "today") return toLocalDateString(isoString) === todayStr;
    if (preset === "yesterday") return toLocalDateString(isoString) === yesterdayStr;
    if (preset === "last7d") return isWithinDays(isoString, 7);
    if (preset === "last30d") return isWithinDays(isoString, 30);
    if (preset === "custom" && customDate) {
      return toLocalDateString(isoString) === customDate;
    }
    return true;
  }

  const safeRequests = useMemo(() => (Array.isArray(requests) ? requests : []), [requests]);
  const safeDeposits = useMemo(() => (Array.isArray(deposits) ? deposits : []), [deposits]);

  const filteredRequests = useMemo(() => {
    return safeRequests.filter((r) => matchesDateFilter(r.createdAt));
  }, [safeRequests, preset, customDate, todayStr, yesterdayStr]);

  const filteredDeposits = useMemo(() => {
    return safeDeposits.filter((d) => matchesDateFilter(d.createdAt));
  }, [safeDeposits, preset, customDate, todayStr, yesterdayStr]);

  const totalReceivedCents = useMemo(() => {
    return filteredDeposits.reduce((acc, curr) => acc + BigInt(Math.round(parseFloat(curr.amountUsdc) * 100)), 0n);
  }, [filteredDeposits]);

  const totalSentCents = useMemo(() => {
    return filteredRequests
      .filter((r) => r.status !== "failed")
      .reduce((acc, curr) => acc + BigInt(Math.round(parseFloat(curr.amountUsdc) * 100)), 0n);
  }, [filteredRequests]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="statement-title">
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 id="statement-title">Account Activity & Statement</h2>
            <p>Two-sided ledger statement of your dollar-backed wallet inflows and local M-Pesa outflows.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close statement">
            ✕
          </button>
        </div>

        {/* Date Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.presetGroup}>
            {(
              [
                ["all", "All Time"],
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["last7d", "Last 7 Days"],
                ["last30d", "Last 30 Days"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={styles.presetBtn}
                data-active={preset === key}
                onClick={() => {
                  setPreset(key);
                  setCustomDate("");
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.customDateGroup}>
            <label htmlFor="custom-date-picker">Specific Day:</label>
            <input
              id="custom-date-picker"
              className={styles.dateInput}
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setPreset("custom");
              }}
            />
            {customDate && (
              <button
                type="button"
                className={styles.clearDateBtn}
                onClick={() => {
                  setCustomDate("");
                  setPreset("all");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* KPI Stats Bar */}
        <div className={styles.statsBar}>
          <div className={`${styles.statItem} ${styles.statReceived}`}>
            <span>TOTAL RECEIVED (INFLOWS)</span>
            <strong>+${formatAmount((Number(totalReceivedCents) / 100).toFixed(2))} USDC</strong>
          </div>
          <div className={`${styles.statItem} ${styles.statSent}`}>
            <span>TOTAL SENT (OUTFLOWS)</span>
            <strong>-${formatAmount((Number(totalSentCents) / 100).toFixed(2))} USDC</strong>
          </div>
          <div className={styles.statItem}>
            <span>TOTAL TRANSACTIONS</span>
            <strong>{filteredDeposits.length + filteredRequests.length}</strong>
          </div>
        </div>

        {/* Two-Sided Statement Body */}
        <div className={styles.statementBody}>
          {/* LEFT COLUMN: RECEIVED */}
          <div className={styles.statementColumn}>
            <div className={styles.colHeading} data-side="received">
              <span>RECEIVED / INFLOWS</span>
              <span className={styles.colCount}>{filteredDeposits.length}</span>
            </div>

            {filteredDeposits.length === 0 ? (
              <div className={styles.emptyCol}>No deposits found for this period.</div>
            ) : (
              filteredDeposits.map((deposit) => (
                <div key={deposit.id} className={styles.itemCard}>
                  <div className={styles.itemTop}>
                    <strong className={styles.inflowAmount}>
                      +{formatAmount(deposit.amountUsdc)} USDC
                    </strong>
                    <span className={styles.statusBadge} data-status="completed">
                      settled
                    </span>
                  </div>
                  <div className={styles.itemSub}>
                    <span>Source: {deposit.source}</span>
                  </div>
                  <div className={styles.itemFooter}>
                    <span>Deposit Confirmed</span>
                    <time dateTime={deposit.createdAt}>{formatDateTime(deposit.createdAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* RIGHT COLUMN: SENT */}
          <div className={styles.statementColumn}>
            <div className={styles.colHeading} data-side="sent">
              <span>SENT / M-PESA CASH-OUTS</span>
              <span className={styles.colCount}>{filteredRequests.length}</span>
            </div>

            {filteredRequests.length === 0 ? (
              <div className={styles.emptyCol}>No cash-out requests found for this period.</div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className={styles.itemCard}>
                  <div className={styles.itemTop}>
                    <strong className={styles.outflowAmount}>
                      -{formatAmount(req.amountUsdc)} USDC
                      {req.netKes && parseFloat(req.netKes) > 0 && (
                        <span style={{ fontSize: 13, color: "var(--forest)", marginLeft: 6 }}>
                          (KES {req.netKes})
                        </span>
                      )}
                    </strong>
                    <span className={styles.statusBadge} data-status={req.status}>
                      {req.status}
                    </span>
                  </div>
                  <div className={styles.itemSub}>
                    <span>
                      To: <strong>{maskPhone(req.phoneNumber)}</strong>
                      {req.recipientName && ` · ${req.recipientName}`}
                    </span>
                    {req.mpesaReceiptNumber && (
                      <code className={styles.receiptCode}>{req.mpesaReceiptNumber}</code>
                    )}
                  </div>
                  {req.failureReason && (
                    <div style={{ color: "var(--error)", fontSize: 11 }}>
                      Reason: {req.failureReason}
                    </div>
                  )}
                  <div className={styles.itemFooter}>
                    <span>M-Pesa B2C Cash-out</span>
                    <time dateTime={req.createdAt}>{formatDateTime(req.createdAt)}</time>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
