import { formatAmount, formatDateTime, maskPhone } from "../../lib/format";
import type { RequestHistory as History } from "../../lib/use-request-history";
import styles from "../page.module.css";

interface RequestHistoryProps {
  history: History;
  onRetry: () => void;
  onOpenFullHistory?: () => void;
}

export function RequestHistory({ history, onRetry, onOpenFullHistory }: RequestHistoryProps) {
  const allRequests = history.status === "ready" ? history.requests : [];
  // Limit dashboard view to the 5 most recent requests to prevent endless page scrolling
  const displayedRequests = allRequests.slice(0, 5);

  return (
    <section className={styles.history} aria-labelledby="history-title" aria-busy={history.status === "loading"}>
      <div className={styles.historyHeading}>
        <div>
          <p className={styles.stepLabel}>YOUR ACTIVITY</p>
          <h2 id="history-title">Previous requests</h2>
        </div>
        <span className={styles.count} aria-hidden="true">
          {history.status === "ready" ? String(allRequests.length).padStart(2, "0") : "—"}
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

      {history.status === "ready" && allRequests.length === 0 && (
        <p className={styles.listMessage}>No requests yet. Your activity will appear here.</p>
      )}

      {history.status === "ready" && displayedRequests.length > 0 && (
        <>
          <ul className={styles.requestList}>
            {displayedRequests.map((request) => (
              <li className={styles.requestItem} key={request.id}>
                <div className={styles.requestAmount}>
                  <strong>
                    {formatAmount(request.amountUsdc)} <small>USDC</small>
                    {request.netKes && parseFloat(request.netKes) > 0 && (
                      <span style={{ color: "var(--forest)", fontWeight: 600, marginLeft: 6 }}>
                        → KES {request.netKes}
                      </span>
                    )}
                  </strong>
                  <span>
                    <span className={styles.srOnly}>To </span>
                    {maskPhone(request.phoneNumber)}
                    {request.recipientName && ` · ${request.recipientName}`}
                  </span>
                  {request.mpesaReceiptNumber && (
                    <span>
                      Receipt: <code className={styles.receiptCode}>{request.mpesaReceiptNumber}</code>
                    </span>
                  )}
                  {request.failureReason && (
                    <span style={{ color: "var(--error)", fontSize: 11 }}>
                      {request.failureReason}
                    </span>
                  )}
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

          {onOpenFullHistory && (
            <button
              type="button"
              className={styles.fullHistoryBtn}
              onClick={onOpenFullHistory}
            >
              View full statement & history ({allRequests.length}) ↗
            </button>
          )}
        </>
      )}
    </section>
  );
}
