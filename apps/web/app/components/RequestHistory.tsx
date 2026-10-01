import { formatAmount, formatDateTime, maskPhone } from "../../lib/format";
import type { RequestHistory as History } from "../../lib/use-request-history";
import styles from "../page.module.css";

export function RequestHistory({ history, onRetry }: { history: History; onRetry: () => void }) {
  return (
    <section className={styles.history} aria-labelledby="history-title" aria-busy={history.status === "loading"}>
      <div className={styles.historyHeading}>
        <div>
          <p className={styles.stepLabel}>YOUR ACTIVITY</p>
          <h2 id="history-title">Previous requests</h2>
        </div>
        <span className={styles.count} aria-hidden="true">
          {history.status === "ready" ? String(history.requests.length).padStart(2, "0") : "—"}
        </span>
      </div>

      {history.status === "loading" && (
        <p className={styles.listMessage} role="status">
          Loading requests…
        </p>
      )}

      {history.status === "error" && (
        <div className={styles.listError} role="alert">
          <p>Requests could not be loaded.</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {history.status === "ready" && history.requests.length === 0 && (
        <p className={styles.listMessage}>No requests yet. Your activity will appear here.</p>
      )}

      {history.status === "ready" && history.requests.length > 0 && (
        <ul className={styles.requestList}>
          {history.requests.map((request) => (
            <li className={styles.requestItem} key={request.id}>
              <div className={styles.requestAmount}>
                <strong>
                  {formatAmount(request.amountUsdc)} <small>USDC</small>
                </strong>
                <span>
                  <span className={styles.srOnly}>To </span>
                  {maskPhone(request.phoneNumber)}
                </span>
              </div>
              <div className={styles.requestMeta}>
                <span className={styles.statusBadge} data-status={request.status}>
                  <span className={styles.srOnly}>Status: </span>
                  {request.status}
                </span>
                <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
