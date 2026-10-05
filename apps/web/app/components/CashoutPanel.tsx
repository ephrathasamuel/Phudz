"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AMOUNT_DECIMAL_PLACES,
  MAX_AMOUNT_USDC,
  MIN_AMOUNT_USDC,
  amountToCents,
  cashoutRequestSchema,
  toFieldErrors,
  type AppConfig,
  type CashoutRequest,
  type QuoteRecord,
  type WalletBalance,
} from "@phundz/shared";
import { ApiError, createCashoutRequest, requestQuote } from "../../lib/api-client";
import { formatAmount } from "../../lib/format";
import styles from "../page.module.css";

type Field = "amount" | "phone";
type FormValues = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;
type Feedback = { type: "success" | "error"; message: string } | null;

const EMPTY_VALUES: FormValues = { amount: "", phone: "" };

function pickFieldErrors(fields: Record<string, string> | undefined): FieldErrors {
  return { amount: fields?.amount, phone: fields?.phone };
}

interface CashoutPanelProps {
  onSubmitted: () => void;
  config?: AppConfig | null;
  wallet?: WalletBalance | null;
}

export function CashoutPanel({ onSubmitted, config, wallet }: CashoutPanelProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [review, setReview] = useState<CashoutRequest | null>(null);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [ttlSeconds, setTtlSeconds] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRender = useRef<"review" | Field | null>(null);

  // Quote expiration countdown timer
  useEffect(() => {
    if (!review || !quote) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
      setTtlSeconds(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [review, quote]);

  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (target === "review") reviewHeadingRef.current?.focus();
    else if (target === "amount") amountRef.current?.focus();
    else if (target === "phone") phoneRef.current?.focus();
  });

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    focusAfterRender.current = next.amount ? "amount" : next.phone ? "phone" : null;
  }

  async function fetchLiveQuote(amount: string, phone: string): Promise<QuoteRecord | null> {
    setQuoting(true);
    try {
      const liveQuote = await requestQuote({ amount, phone });
      setQuote(liveQuote);
      setTtlSeconds(liveQuote.ttlSeconds);
      return liveQuote;
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        showErrors(pickFieldErrors(error.fields));
      } else {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Could not fetch quote.",
        });
      }
      return null;
    } finally {
      setQuoting(false);
    }
  }

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const result = cashoutRequestSchema.safeParse(values);
    if (!result.success) {
      showErrors(pickFieldErrors(toFieldErrors(result.error)));
      return;
    }

    // Check available balance if wallet is loaded
    if (wallet && amountToCents(result.data.amount) > amountToCents(wallet.availableUsdc)) {
      showErrors({
        amount: `Amount exceeds available balance of ${formatAmount(wallet.availableUsdc)} USDC`,
      });
      return;
    }

    // Fetch locked quote from provider
    const fetched = await fetchLiveQuote(result.data.amount, result.data.phone);
    if (!fetched) return;

    setErrors({});
    setReview({
      amount: result.data.amount,
      phone: result.data.phone,
      quoteId: fetched.id,
    });
    focusAfterRender.current = "review";
  }

  function handleEdit() {
    setReview(null);
    focusAfterRender.current = "amount";
  }

  async function handleRefreshQuote() {
    if (!review) return;
    const refreshed = await fetchLiveQuote(review.amount, review.phone);
    if (refreshed) {
      setReview((curr) => (curr ? { ...curr, quoteId: refreshed.id } : null));
      setFeedback(null);
    }
  }

  async function handleConfirm() {
    if (!review || submitting) return;
    if (ttlSeconds <= 0) {
      setFeedback({ type: "error", message: "Quote has expired. Please refresh the rate to proceed." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    // Create client idempotency key to prevent double-charging on network retry
    const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`;

    try {
      await createCashoutRequest({
        ...review,
        quoteId: quote?.id,
        idempotencyKey,
      });

      setReview(null);
      setQuote(null);
      setValues(EMPTY_VALUES);
      setFeedback({
        type: "success",
        message: "Cash-out request submitted! Ledger hold placed; M-Pesa B2C processing.",
      });
      focusAfterRender.current = "amount";
      onSubmitted();
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? pickFieldErrors(error.fields) : {};
      if (fieldErrors.amount || fieldErrors.phone) {
        setReview(null);
        showErrors(fieldErrors);
        setFeedback({ type: "error", message: "Please correct the highlighted fields." });
      } else {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Could not save the request.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isMock = config?.mode !== "live";

  return (
    <section className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stepLabel}>{review ? "STEP 02 / 02 · LOCKED QUOTE" : "STEP 01 / 02"}</p>
          <h2 id="request-title" ref={reviewHeadingRef} tabIndex={-1}>
            {review ? "Review request" : "Request details"}
          </h2>
        </div>
        <span className={styles.currencyTag}>
          USDC <span aria-hidden="true">→</span> KES
        </span>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true">
        {feedback && (
          <p className={`${styles.feedback} ${feedback.type === "success" ? styles.success : styles.failure}`}>
            {feedback.message}
          </p>
        )}
      </div>

      {review ? (
        <div className={styles.review}>
          {quote && (
            <div className={styles.quoteCountdown}>
              <span>
                {ttlSeconds > 0 ? (
                  <>Quote locked: <strong>{ttlSeconds}s</strong> remaining</>
                ) : (
                  <strong style={{ color: "var(--error)" }}>Quote expired</strong>
                )}
              </span>
              <button type="button" onClick={() => void handleRefreshQuote()} disabled={quoting}>
                {quoting ? "Updating…" : "Refresh rate"}
              </button>
            </div>
          )}

          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>Cash-out amount</dt>
              <dd>
                <strong>
                  {formatAmount(review.amount)} <small>USDC</small>
                </strong>
              </dd>
            </div>

            {quote && (
              <>
                <div className={styles.summaryRow}>
                  <dt>Network & provider fee</dt>
                  <dd>
                    <strong>
                      {formatAmount(quote.feeUsdc)} <small>USDC</small>
                    </strong>
                  </dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Guaranteed FX rate</dt>
                  <dd>
                    <strong>1 USDC = {quote.rateKes} KES</strong>
                  </dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Total to receive (M-Pesa)</dt>
                  <dd>
                    <strong className={styles.payoutTotal}>
                      KES {quote.netKes}
                    </strong>
                  </dd>
                </div>
              </>
            )}

            <div className={styles.summaryRow}>
              <dt>Send to (M-Pesa)</dt>
              <dd className={styles.recipientBlock}>
                <strong className={styles.recipientPhone}>{review.phone}</strong>
                {quote?.recipientName && (
                  <div className={styles.verifiedName}>
                    <span className={styles.recipientNameText}>{quote.recipientName}</span>
                    <span className={styles.verifiedBadge}>Verified</span>
                  </div>
                )}
              </dd>
            </div>
          </dl>

          <div className={styles.demoNotice} role="note">
            <span className={styles.noticeMark} aria-hidden="true">
              i
            </span>
            <p>
              <strong>{isMock ? "Demo only, no real funds move." : "Production M-Pesa B2C Cash-out."}</strong>
              <br />
              {isMock
                ? "This request places a temporary hold while simulating an asynchronous Safaricom M-Pesa payout."
                : "Funds will be debited from your USDC balance and sent directly to the recipient phone number."}
            </p>
          </div>

          <div className={styles.reviewActions}>
            <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={submitting}>
              Edit
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting || ttlSeconds <= 0}
              aria-busy={submitting}
            >
              {submitting ? "Submitting…" : "Confirm"}
              {!submitting && <span aria-hidden="true">↗</span>}
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={(e) => void handleReview(e)} noValidate>
          <div className={styles.field}>
            <label htmlFor="amount">Amount in USDC</label>
            <div className={`${styles.inputWrap} ${errors.amount ? styles.inputError : ""}`}>
              <input
                ref={amountRef}
                id="amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={values.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "amount-error amount-hint" : "amount-hint"}
              />
              <span className={styles.inputSuffix} aria-hidden="true">
                USDC
              </span>
            </div>
            {errors.amount && (
              <p className={styles.fieldError} id="amount-error" role="alert">
                {errors.amount}
              </p>
            )}
            <p className={styles.hint} id="amount-hint">
              Between {formatAmount(MIN_AMOUNT_USDC)} and {formatAmount(MAX_AMOUNT_USDC)}, up to{" "}
              {AMOUNT_DECIMAL_PLACES} decimal places
              {wallet && ` · Available: ${formatAmount(wallet.availableUsdc)} USDC`}
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="phone">M-Pesa phone number</label>
            <input
              ref={phoneRef}
              className={`${styles.plainInput} ${errors.phone ? styles.inputError : ""}`}
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="07XX XXX XXX"
              value={values.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "phone-error phone-hint" : "phone-hint"}
            />
            {errors.phone && (
              <p className={styles.fieldError} id="phone-error" role="alert">
                {errors.phone}
              </p>
            )}
            <p className={styles.hint} id="phone-hint">
              Kenyan number, e.g. 0712 345 678 or +254 712 345 678
            </p>
          </div>

          <button className={styles.primaryButton} type="submit" disabled={quoting}>
            {quoting ? "Getting live quote…" : "Review"} {!quoting && <span aria-hidden="true">↗</span>}
          </button>
        </form>
      )}
    </section>
  );
}
