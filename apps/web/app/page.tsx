"use client";

import { useRequestHistory } from "../lib/use-request-history";
import { CashoutPanel } from "./components/CashoutPanel";
import { RequestHistory } from "./components/RequestHistory";
import styles from "./page.module.css";

export default function HomePage() {
  const { history, reload } = useRequestHistory();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>
          phundz<span aria-hidden="true">.</span>
        </span>
        <span className={styles.walletLabel}>
          <i aria-hidden="true" /> DEMO WALLET
        </span>
      </header>

      <main className={styles.content}>
        <section className={styles.intro} aria-labelledby="page-title">
          <p className={styles.eyebrow}>LOCAL CASH-OUT / SIMULATION</p>
          <h1 id="page-title">
            Cash out
            <br />
            <em>with clarity.</em>
          </h1>
          <p className={styles.introCopy}>
            Create a demo cash-out request from your dollar-backed balance to a Kenyan M-Pesa number.
          </p>
        </section>

        <CashoutPanel onSubmitted={() => void reload()} />
        <RequestHistory history={history} onRetry={() => void reload()} />
      </main>

      <footer className={styles.footer}>
        <span>PHUNDZ · DEMO ENVIRONMENT</span>
        <span>Nothing is exchanged or paid out.</span>
      </footer>
    </div>
  );
}
