"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cashoutRequestSchema, type CashoutRequest } from "@phundz/shared";
import { ApiError, createCashoutRequest } from "../../lib/api-client";
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

export function CashoutPanel({ onSubmitted }: { onSubmitted: () => void }) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [review, setReview] = useState<CashoutRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRender = useRef<"review" | Field | null>(null);

  // Move focus to the right place when the step changes, so keyboard and
  // screen reader users are not left on an unmounted element.
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

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const result = cashoutRequestSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "amount" || field === "phone") next[field] ??= issue.message;
      }
      showErrors(next);
      return;
    }
    setErrors({});
    setReview(result.data);
    focusAfterRender.current = "review";
  }

  function handleEdit() {
    setReview(null);
    focusAfterRender.current = "amount";
  }

  async function handleConfirm() {
    if (!review || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await createCashoutRequest(review);
      setReview(null);
      setValues(EMPTY_VALUES);
      setFeedback({ type: "success", message: "Request saved as pending. This is a demo: no funds were moved." });
      focusAfterRender.current = "amount";
      onSubmitted();
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? pickFieldErrors(error.fields) : {};
      if (fieldErrors.amount || fieldErrors.phone) {
        // Send the user back to the form so they can fix what the server rejected.
        setReview(null);
        showErrors(fieldErrors);
        setFeedback({ type: "error", message: "Please correct the highlighted fields." });
      } else {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Could not save the request." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.requestSection} aria-labelledby="request-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.stepLabel}>{review ? "STEP 02 / 02" : "STEP 01 / 02"}</p>
          <h2 id="request-title" ref={reviewHeadingRef} tabIndex={-1}>
            {review ? "Review request" : "Request details"}
          </h2>
        </div>
        <span className={styles.currencyTag}>
          USDC <span aria-hidden="true">→</span> KES
        </span>
      </div>

      {/* Always mounted so assistive tech reliably announces changes. */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {feedback && (
          <p className={`${styles.feedback} ${feedback.type === "success" ? styles.success : styles.failure}`}>
            {feedback.message}
          </p>
        )}
      </div>

      {review ? (
        <div className={styles.review}>
          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>Cash-out amount</dt>
              <dd>
                <strong>
                  {formatAmount(review.amount)} <small>USDC</small>
                </strong>
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Send to (M-Pesa)</dt>
              <dd>
                <strong>{review.phone}</strong>
              </dd>
            </div>
          </dl>
          <div className={styles.demoNotice} role="note">
            <span className={styles.noticeMark} aria-hidden="true">
              i
            </span>
            <p>
              <strong>Demo only, no real funds move.</strong>
              <br />
              This request is saved as pending and will not be processed or paid out.
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
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Submitting…" : "Confirm"}
              {!submitting && <span aria-hidden="true">↗</span>}
            </button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleReview} noValidate>
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
              Between 1.00 and 1,000.00, up to 2 decimal places
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

          <button className={styles.primaryButton} type="submit">
            Review <span aria-hidden="true">↗</span>
          </button>
        </form>
      )}
    </section>
  );
}
