"use client";

import { useEffect, useState, type FormEvent } from "react";
import { cashoutRequestSchema, type CashoutRequestRecord } from "@phundz/shared";
import { ApiClientError, createCashoutRequest, listCashoutRequests } from "../lib/api-client";
import styles from "./page.module.css";

type FormValues = { amount: string; phone: string };
type FieldErrors = Partial<Record<keyof FormValues, string>>;

function formatAmount(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace("+254", "");
  return `+254 ${digits[0]}•• ••• ${digits.slice(-3)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function HomePage() {
  const [values, setValues] = useState<FormValues>({ amount: "", phone: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [review, setReview] = useState<{ amount: string; phone: string } | null>(null);
  const [requests, setRequests] = useState<CashoutRequestRecord[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function refreshRequests() {
    setListState("loading");
    try {
      setRequests(await listCashoutRequests());
      setListState("ready");
    } catch {
      setListState("error");
    }
  }

  useEffect(() => {
    void refreshRequests();
  }, []);

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const result = cashoutRequestSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "amount" || field === "phone") nextErrors[field] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setReview(result.data);
  }

  async function handleConfirm() {
    if (!review) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await createCashoutRequest(review);
      setFeedback({ type: "success", message: "Request saved as pending. No funds were moved." });
      setReview(null);
      setValues({ amount: "", phone: "" });
      await refreshRequests();
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Could not save request." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.wordmark} href="#top" aria-label="Phundz home">phundz<span>.</span></a>
        <span className={styles.walletLabel}><i aria-hidden="true" /> DEMO WALLET</span>
      </header>

      <div className={styles.content} id="top">
        <section className={styles.intro} aria-labelledby="page-title">
          <p className={styles.eyebrow}>LOCAL CASH-OUT / SIMULATION</p>
          <h1 id="page-title">Cash out<br /><em>with clarity.</em></h1>
          <p className={styles.introCopy}>Create a demo request from your dollar-backed balance to a Kenyan mobile number.</p>
        </section>

        <section className={styles.requestSection} aria-labelledby="request-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.stepLabel}>{review ? "STEP 02 / 02" : "STEP 01 / 02"}</p>
              <h2 id="request-title">{review ? "Review request" : "Request details"}</h2>
            </div>
            <span className={styles.currencyTag}>USDC <span>→</span> KES</span>
          </div>

          {feedback && (
            <p className={`${styles.feedback} ${feedback.type === "success" ? styles.success : styles.failure}`} role="status" aria-live="polite">
              {feedback.message}
            </p>
          )}

          {!review ? (
            <form className={styles.form} onSubmit={handleReview} noValidate>
              <div className={styles.field}>
                <label htmlFor="amount">Amount in USDC</label>
                <div className={`${styles.inputWrap} ${errors.amount ? styles.inputError : ""}`}>
                  <input id="amount" name="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={values.amount} onChange={(event) => updateField("amount", event.target.value)} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "amount-error amount-hint" : "amount-hint"} />
                  <span className={styles.inputSuffix}>USDC</span>
                </div>
                {errors.amount && <p className={styles.fieldError} id="amount-error" role="alert">{errors.amount}</p>}
                <p className={styles.hint} id="amount-hint">Between 1.00 and 1,000.00 · 2 decimal places</p>
              </div>

              <div className={styles.field}>
                <label htmlFor="phone">M-Pesa phone number</label>
                <input className={`${styles.plainInput} ${errors.phone ? styles.inputError : ""}`} id="phone" name="phone" type="tel" autoComplete="tel" placeholder="07XX XXX XXX" value={values.phone} onChange={(event) => updateField("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error phone-hint" : "phone-hint"} />
                {errors.phone && <p className={styles.fieldError} id="phone-error" role="alert">{errors.phone}</p>}
                <p className={styles.hint} id="phone-hint">Kenyan number beginning 07 or 01</p>
              </div>

              <button className={styles.primaryButton} type="submit">Review request <span aria-hidden="true">↗</span></button>
            </form>
          ) : (
            <div className={styles.review}>
              <div className={styles.summaryRow}><span>Cash-out amount</span><strong>{formatAmount(review.amount)} <small>USDC</small></strong></div>
              <div className={styles.summaryRow}><span>Send to</span><strong>{maskPhone(review.phone)}</strong></div>
              {errors.amount && <p className={styles.fieldError} role="alert">Amount: {errors.amount}</p>}
              {errors.phone && <p className={styles.fieldError} role="alert">Phone: {errors.phone}</p>}
              <div className={styles.demoNotice} role="note">
                <span className={styles.noticeMark} aria-hidden="true">i</span>
                <p><strong>Demo only, no real funds move.</strong><br />This request is saved as pending and will not be processed or paid out.</p>
              </div>
              <div className={styles.reviewActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setReview(null)}>Edit</button>
                <button className={styles.primaryButton} type="button" onClick={() => void handleConfirm()} disabled={submitting}>
                  {submitting ? "Saving…" : "Confirm request"}
                  {!submitting && <span aria-hidden="true">↗</span>}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={styles.history} aria-labelledby="history-title">
          <div className={styles.historyHeading}>
            <div><p className={styles.stepLabel}>YOUR ACTIVITY</p><h2 id="history-title">Previous requests</h2></div>
            <span className={styles.count}>{listState === "ready" ? requests.length.toString().padStart(2, "0") : "—"}</span>
          </div>

          {listState === "loading" && <p className={styles.listMessage} role="status">Loading requests…</p>}
          {listState === "error" && <div className={styles.listError}><p>Requests could not be loaded.</p><button type="button" onClick={() => void refreshRequests()}>Try again</button></div>}
          {listState === "ready" && requests.length === 0 && <p className={styles.listMessage}>No requests yet. Your activity will appear here.</p>}
          {listState === "ready" && requests.length > 0 && (
            <ul className={styles.requestList}>
              {requests.map((request) => (
                <li className={styles.requestItem} key={request.id}>
                  <div className={styles.requestAmount}><strong>{formatAmount(request.amount_usdc)} <small>USDC</small></strong><span>{maskPhone(request.phone_number)}</span></div>
                  <div className={styles.requestMeta}><span className={styles.statusBadge}>{request.status}</span><time dateTime={request.created_at}>{formatDate(request.created_at)}</time></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <footer className={styles.footer}><span>PHUNDZ · DEMO ENVIRONMENT</span><span>Nothing is exchanged or paid out.</span></footer>
    </main>
  );
}