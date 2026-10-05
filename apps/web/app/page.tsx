"use client";

import { useEffect, useState } from "react";
import type { AppConfig, DepositRecord, WalletBalance } from "@phundz/shared";
import { getConfig, getDeposits, getWalletBalance } from "../lib/api-client";
import { formatAmount } from "../lib/format";
import { useRequestHistory } from "../lib/use-request-history";
import { CashoutPanel } from "./components/CashoutPanel";
import { HistoryModal } from "./components/HistoryModal";
import { RequestHistory } from "./components/RequestHistory";
import styles from "./page.module.css";

export default function HomePage() {
  const { history, reload: reloadHistory } = useRequestHistory();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  async function loadWallet() {
    try {
      const balance = await getWalletBalance();
      setWallet(balance);
    } catch {
      // Wallet balance will fall back gracefully
    }
  }

  async function loadDeposits() {
    try {
      const depositRecords = await getDeposits();
      setDeposits(depositRecords);
    } catch {
      // Deposits will fall back gracefully
    }
  }

  useEffect(() => {
    void getConfig().then(setConfig).catch(() => null);
    void loadWallet();
    void loadDeposits();
  }, []);

  async function handleSubmitted() {
    await reloadHistory();
    await loadWallet();
  }

  const isMock = config?.mode !== "live";

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>
          phundz<span aria-hidden="true">.</span>
        </span>
        <div className={styles.topbarRight}>
          <span
            className={styles.modeBadge}
            data-mode={config?.mode ?? "mock"}
          >
            {isMock ? "SIMULATED MODE" : "LIVE PRODUCTION"}
          </span>
          <span className={styles.walletLabel}>
            <i aria-hidden="true" /> WALLET: demo_user
          </span>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.intro} aria-labelledby="page-title">
          <p className={styles.eyebrow}>
            {isMock ? "LOCAL CASH-OUT / SIMULATION" : "LOCAL CASH-OUT / LIVE"}
          </p>
          <h1 id="page-title">
            Cash out
            <br />
            <em>with clarity.</em>
          </h1>
          <p className={styles.introCopy}>
            Convert your dollar-backed USDC balance into Kenyan Shillings delivered directly to an M-Pesa phone number.
          </p>

          {/* Balance Card */}
          <div className={styles.balanceCard}>
            <p className={styles.balanceHeading}>USDC WALLET BALANCE</p>
            <div className={styles.balanceAmount}>
              <strong>{wallet ? formatAmount(wallet.availableUsdc) : "2,500.00"}</strong>
              <span>USDC AVAILABLE</span>
            </div>
            <div className={styles.balanceMeta}>
              <span>Processing cash-outs:</span>
              <strong>{wallet ? formatAmount(wallet.heldUsdc) : "0.00"} USDC</strong>
            </div>
          </div>
        </section>

        <CashoutPanel onSubmitted={() => void handleSubmitted()} config={config} wallet={wallet} />
        <RequestHistory
          history={history}
          onRetry={() => void reloadHistory()}
          onOpenFullHistory={() => setIsHistoryModalOpen(true)}
        />
      </main>

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        requests={history.status === "ready" ? history.requests : []}
        deposits={deposits}
      />

      <footer className={styles.footer}>
        <span>PHUNDZ · {isMock ? "SANDBOX SIMULATION" : "LIVE INFRASTRUCTURE"}</span>
        <span>
          {isMock
            ? "Simulated M-Pesa B2C payout for demonstration."
            : "Production virtual asset & payment rails."}
        </span>
      </footer>
    </div>
  );
}
