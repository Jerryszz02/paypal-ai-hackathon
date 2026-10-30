'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileImage,
  FileText,
  Info,
  LoaderCircle,
  LockKeyhole,
  Save,
  ScanLine,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { Category, ClaimDetail, ClaimInput } from '@/lib/types';
import { api, categoryLabels, errorMessage, money, sourceFieldLabel, useApp } from './app-provider';
import { EmptyState, ErrorBox, Modal, StepPill } from './ui';

interface Fields {
  merchant: string;
  date: string;
  amount: string;
  currency: string;
  category: Category;
  purpose: string;
  paymentNote: string;
  partialExplanation: string;
  fieldsConfirmed: boolean;
  paidConfirmed: boolean;
}
function fromClaim(claim?: ClaimDetail): Fields {
  return {
    merchant: claim?.merchant ?? '',
    date: claim?.date ?? '',
    amount: claim?.amountMinor != null ? (claim.amountMinor / 100).toFixed(2) : '',
    currency: claim?.currency ?? 'GBP',
    category: claim?.category ?? 'transport',
    purpose: claim?.purpose ?? '',
    paymentNote: claim?.paymentNote ?? '',
    partialExplanation: claim?.partialExplanation ?? '',
    fieldsConfirmed: claim?.fieldsConfirmed ?? false,
    paidConfirmed: claim?.paidConfirmed ?? false,
  };
}
function claimInput(fields: Fields): ClaimInput {
  const amount = fields.amount.trim();
  if (amount && !/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw new Error('Enter the amount in pounds and pence, for example 23.80.');
  const [pounds, pence = ''] = amount.split('.');
  const amountMinor = amount ? Number(pounds) * 100 + Number(pence.padEnd(2, '0')) : null;
  if (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor < 0))
    throw new Error('Enter a valid amount.');
  return {
    merchant: fields.merchant,
    date: fields.date || null,
    amountMinor,
    currency: fields.currency,
    category: fields.category,
    purpose: fields.purpose,
    paymentNote: fields.paymentNote,
    partialExplanation: fields.partialExplanation,
    fieldsConfirmed: fields.fieldsConfirmed,
    paidConfirmed: fields.paidConfirmed,
  };
}
function changedFields(current: ClaimDetail, input: ClaimInput): Partial<ClaimInput> {
  const result: Partial<ClaimInput> = {};
  for (const key of Object.keys(input) as (keyof ClaimInput)[]) {
    if (input[key] !== current[key]) Object.assign(result, { [key]: input[key] });
  }
  return result;
}

export function ClaimEditor({
  initial,
  onSaved,
}: {
  initial?: ClaimDetail;
  onSaved?: (claim: ClaimDetail) => void;
}) {
  const { data, reload, notify } = useApp();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [detail, setDetail] = useState<ClaimDetail | null>(initial ?? null);
  const [fields, setFields] = useState<Fields>(() => fromClaim(initial));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  if (!data) return null;
  if (data.member.role !== 'applicant')
    return (
      <EmptyState
        title="Finance accounts are for reviewing claims."
        description="Sign in as a team member to submit a reimbursement request."
      >
        <Link href="/review" className="button primary">
          Open review queue
        </Link>
      </EmptyState>
    );
  const change = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((previous) => ({
      ...previous,
      [key]: value,
      ...(key !== 'fieldsConfirmed' && key !== 'paidConfirmed' ? { fieldsConfirmed: false } : {}),
    }));
  const extraction = detail?.extraction;
  async function ensureDraft() {
    if (detail) return detail;
    const next = await api<ClaimDetail>('/api/claims', {
      method: 'POST',
      body: JSON.stringify(claimInput(fields)),
    });
    setDetail(next);
    await reload();
    return next;
  }
  async function upload(files: FileList | File[]) {
    if (!files.length || busy) return;
    setBusy('upload');
    setError('');
    try {
      if (files.length + (detail?.attachments.length ?? 0) > 3)
        throw new Error(
          'A claim can include up to 3 files. Keep the originals and add only the evidence needed.',
        );
      if (
        Array.from(files).reduce((total, file) => total + file.size, 0) +
          (detail?.attachments.reduce((total, file) => total + file.size, 0) ?? 0) >
        10 * 1024 * 1024
      )
        throw new Error('The files exceed 10 MB in total. Choose smaller JPEG, PNG or PDF files.');
      if (
        Array.from(files).some(
          (file) => !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type),
        )
      )
        throw new Error('Choose JPEG, PNG or PDF files.');
      const current = await ensureDraft();
      const form = new FormData();
      form.append('expectedVersion', String(current.version));
      Array.from(files).forEach((file) => form.append('files', file));
      const next = await api<ClaimDetail>(`/api/claims/${current.id}/attachments`, {
        method: 'POST',
        body: form,
      });
      setDetail(next);
      setFields((previous) => ({ ...previous, fieldsConfirmed: false }));
      await reload();
      notify('Receipt saved privately. You can now extract its details.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  async function sample(sample: 'clear' | 'blurred' | 'large_clear' | 'partial') {
    setBusy(sample);
    setError('');
    try {
      const current = await ensureDraft();
      const next = await api<ClaimDetail>(`/api/claims/${current.id}/sample`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: current.version, sample }),
      });
      setDetail(next);
      setFields(fromClaim(next));
      await reload();
      notify('Synthetic receipt added. Confirm its details before submitting.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }
  async function removeAttachment(attachmentId: string) {
    if (!detail) return;
    setBusy(attachmentId);
    setError('');
    try {
      const next = await api<ClaimDetail>(`/api/claims/${detail.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ expectedVersion: detail.version }),
      });
      setDetail(next);
      setFields((previous) => ({ ...previous, fieldsConfirmed: false }));
      await reload();
      notify('Attachment removed from this version. The original remains in the claim history.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }
  async function extract() {
    setBusy('extract');
    setError('');
    try {
      const draft = await ensureDraft();
      const changes = changedFields(draft, { ...claimInput(fields), fieldsConfirmed: false });
      const current = Object.keys(changes).length
        ? await api<ClaimDetail>(`/api/claims/${draft.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ expectedVersion: draft.version, ...changes }),
          })
        : draft;
      setDetail(current);
      const next = await api<ClaimDetail>(`/api/claims/${current.id}/extract`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: current.version }),
      });
      setDetail(next);
      setFields((previous) => ({ ...previous, fieldsConfirmed: false }));
      await reload();
      if (next.extraction?.status === 'failed')
        setError(
          'The receipt could not be read reliably. Keep the original, enter what you can confirm, and submit for a finance review.',
        );
      else
        notify(
          data?.mode === 'demo'
            ? 'Simulated extraction ready. Review the source and confirm the details.'
            : 'Receipt details extracted. Review the source before confirming.',
        );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }
  function useExtraction() {
    if (!extraction) return;
    setFields((previous) => ({
      ...previous,
      merchant: extraction.merchant ?? previous.merchant,
      date: extraction.date ?? previous.date,
      currency: extraction.currency ?? previous.currency,
      amount:
        extraction.totalMinor === null ? previous.amount : (extraction.totalMinor / 100).toFixed(2),
      fieldsConfirmed: false,
    }));
    notify('Extracted values copied. Check them against the original receipt.');
  }
  async function save(submit: boolean) {
    setBusy(submit ? 'submit' : 'save');
    setError('');
    setSubmitOpen(false);
    try {
      const input = claimInput(fields);
      let next: ClaimDetail;
      if (!detail)
        next = await api<ClaimDetail>('/api/claims', {
          method: 'POST',
          body: JSON.stringify(input),
        });
      else {
        const changes = changedFields(detail, input);
        next = Object.keys(changes).length
          ? await api<ClaimDetail>(`/api/claims/${detail.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ expectedVersion: detail.version, ...changes }),
            })
          : detail;
      }
      setDetail(next);
      if (submit) {
        next = await api<ClaimDetail>(`/api/claims/${next.id}/submit`, {
          method: 'POST',
          body: JSON.stringify({ expectedVersion: next.version }),
        });
        setDetail(next);
      }
      await reload();
      notify(
        submit
          ? 'Claim submitted. Your checks and next steps are ready.'
          : 'Claim saved. You can come back to it at any time.',
      );
      if (onSaved) onSaved(next);
      else router.push(`/claims/${next.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="editor-page">
      {!initial && (
        <>
          <Link className="back-link" href="/claims">
            <ArrowLeft size={16} />
            Back to claims
          </Link>
          <div className="page-heading">
            <div>
              <span className="eyebrow">NEW REIMBURSEMENT</span>
              <h1>Start with the receipt.</h1>
              <p>One expense, one claim. Add what you have — we’ll show you what’s missing.</p>
            </div>
            <span className="private-label">
              <LockKeyhole size={15} />
              Private to you & finance
            </span>
          </div>
        </>
      )}
      <div className="editor-steps">
        <StepPill done={!!detail?.attachments.length} current={!detail?.attachments.length}>
          Add evidence
        </StepPill>
        <Chevron />
        <StepPill
          done={fields.fieldsConfirmed}
          current={!!detail?.attachments.length && !fields.fieldsConfirmed}
        >
          Confirm details
        </StepPill>
        <Chevron />
        <StepPill>Submit for checks</StepPill>
      </div>
      <ErrorBox message={error} />
      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel form-panel">
            <div className="section-heading">
              <span className="section-icon">
                <UploadCloud size={20} />
              </span>
              <div>
                <h2>Receipt & evidence</h2>
                <p>A receipt, plus proof you paid if it isn’t shown on the receipt.</p>
              </div>
            </div>
            <div
              className={`upload-zone ${dragging ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void upload(event.dataTransfer.files);
              }}
            >
              <span className="upload-icon">
                <UploadCloud size={29} strokeWidth={1.5} />
              </span>
              <h3>Drop your receipt here</h3>
              <p>JPEG, PNG or PDF · Up to 3 files, 10 MB total · PDF up to 5 pages</p>
              <button
                type="button"
                className="button secondary"
                disabled={!!busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy === 'upload' ? <LoaderCircle size={16} className="spin" /> : <PlusIcon />}
                Choose files
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                className="sr-only"
                aria-label="Upload receipt files"
                onChange={(event) => {
                  if (event.target.files) void upload(event.target.files);
                }}
              />
            </div>
            {!!detail?.attachments.length && (
              <div className="attachment-list">
                {detail.attachments.map((attachment) => (
                  <div className="attachment-item" key={attachment.id}>
                    <span className="attachment-icon">
                      {attachment.mediaType === 'application/pdf' ? (
                        <FileText size={21} />
                      ) : (
                        <FileImage size={21} />
                      )}
                    </span>
                    <div>
                      <a
                        href={`/api/attachments/${attachment.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {attachment.name}
                      </a>
                      <span>
                        {(attachment.size / 1024).toFixed(0)} KB · {attachment.pages}{' '}
                        {attachment.pages === 1 ? 'page' : 'pages'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${attachment.name} from this version`}
                      disabled={!!busy}
                      onClick={() => void removeAttachment(attachment.id)}
                    >
                      {busy === attachment.id ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                ))}
                <button
                  className="button secondary extract-button"
                  type="button"
                  disabled={!!busy}
                  onClick={() => void extract()}
                >
                  {busy === 'extract' ? (
                    <>
                      <LoaderCircle size={17} className="spin" />
                      Reading your receipt…
                    </>
                  ) : (
                    <>
                      <ScanLine size={17} />
                      {data.mode === 'demo'
                        ? 'Run simulated extraction'
                        : 'Extract receipt details'}
                    </>
                  )}
                </button>
              </div>
            )}
            {data.mode === 'demo' && (
              <div className="sample-picker">
                <span>Try a synthetic receipt</span>
                <div>
                  <button disabled={!!busy} type="button" onClick={() => void sample('clear')}>
                    {busy === 'clear' ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    Clear · £23.80
                  </button>
                  <button disabled={!!busy} type="button" onClick={() => void sample('blurred')}>
                    {busy === 'blurred' ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    Blurry · £420
                  </button>
                  <button
                    disabled={!!busy}
                    type="button"
                    onClick={() => void sample('large_clear')}
                  >
                    {busy === 'large_clear' ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    Clear replacement · £420
                  </button>
                  <button disabled={!!busy} type="button" onClick={() => void sample('partial')}>
                    {busy === 'partial' ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    Partial · £30
                  </button>
                </div>
                <small>
                  Samples have prepared test results. Arbitrary uploads require manual review in
                  demo mode.
                </small>
              </div>
            )}
            <p className="field-note">
              <ShieldCheck size={14} />
              {data.mode === 'demo'
                ? 'Stored only in this local demo. No external AI calls are made.'
                : 'Selecting extraction sends these files to the configured AI provider. Check its output before confirming.'}
            </p>
          </section>
          <section className="panel form-panel">
            <div className="section-heading">
              <span className="section-icon">
                <FileText size={20} />
              </span>
              <div>
                <h2>Expense details</h2>
                <p>Confirm the facts against your original receipt.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="full-width">
                Merchant
                <input
                  value={fields.merchant}
                  placeholder="e.g. Northern Rail"
                  maxLength={200}
                  onChange={(event) => change('merchant', event.target.value)}
                />
              </label>
              <label>
                Expense date
                <input
                  type="date"
                  value={fields.date}
                  onChange={(event) => change('date', event.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  value={fields.category}
                  onChange={(event) => change('category', event.target.value as Category)}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount to reimburse
                <div className="input-affix">
                  <span>£</span>
                  <input
                    inputMode="decimal"
                    value={fields.amount}
                    placeholder="0.00"
                    onChange={(event) => change('amount', event.target.value)}
                    aria-label="Amount to reimburse"
                  />
                </div>
              </label>
              <label>
                Currency
                <select
                  value={fields.currency}
                  onChange={(event) => change('currency', event.target.value)}
                >
                  <option value="GBP">GBP — British pound</option>
                  {fields.currency !== 'GBP' && (
                    <option value={fields.currency}>{fields.currency} — requires review</option>
                  )}
                </select>
              </label>
              <label className="full-width">
                What was this expense for?
                <textarea
                  value={fields.purpose}
                  placeholder="A short, specific work purpose helps finance review your claim."
                  rows={3}
                  maxLength={2000}
                  onChange={(event) => change('purpose', event.target.value)}
                />
                <span className="field-hint">
                  You can write your purpose in English or Chinese.
                </span>
              </label>
              <label className="full-width">
                How did you pay?
                <textarea
                  value={fields.paymentNote}
                  placeholder="e.g. Paid in full using my personal debit card; the receipt shows the card payment."
                  rows={2}
                  maxLength={2000}
                  onChange={(event) => change('paymentNote', event.target.value)}
                />
              </label>
              <label className="full-width">
                Partial reimbursement or other context <span className="optional">(optional)</span>
                <textarea
                  value={fields.partialExplanation}
                  placeholder="Explain any difference between the receipt total and the amount requested."
                  rows={2}
                  maxLength={2000}
                  onChange={(event) => change('partialExplanation', event.target.value)}
                />
              </label>
            </div>
            <div className="confirmation-box">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={fields.fieldsConfirmed}
                  onChange={(event) => change('fieldsConfirmed', event.target.checked)}
                />
                <span>
                  I checked the merchant, date, currency and amount against my evidence.
                  <small>
                    Unconfirmed details can be submitted, but will need more information before
                    approval.
                  </small>
                </span>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={fields.paidConfirmed}
                  onChange={(event) => change('paidConfirmed', event.target.checked)}
                />
                <span>I personally paid this expense and have included evidence of payment.</span>
              </label>
            </div>
          </section>
        </div>
        <aside className="editor-aside">
          {extraction ? (
            <section className="panel extraction-card">
              <div className="section-heading compact">
                <ScanLine size={19} />
                <h2>
                  {extraction.provider === 'demo' ? 'Sample extraction' : 'Extracted details'}
                </h2>
              </div>
              <span
                className={`extraction-state ${extraction.status === 'complete' ? 'complete' : ''}`}
              >
                {extraction.status === 'complete' ? 'Ready to check' : 'Needs a closer look'}
              </span>
              <dl>
                <div>
                  <dt>Merchant</dt>
                  <dd>{extraction.merchant || 'Could not read'}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{extraction.date || 'Could not read'}</dd>
                </div>
                <div>
                  <dt>Receipt total</dt>
                  <dd>{money(extraction.totalMinor, extraction.currency || 'GBP')}</dd>
                </div>
              </dl>
              {extraction.issues.length > 0 && (
                <div className="extraction-issues">
                  <Info size={16} />
                  <ul>
                    {extraction.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {extraction.sources.slice(0, 8).map((source, index) => (
                <div className="source-quote" key={index}>
                  <span>
                    {sourceFieldLabel(source.field)} · Page {source.page}
                  </span>
                  <blockquote>“{source.quote}”</blockquote>
                </div>
              ))}
              <button
                className="button secondary"
                type="button"
                disabled={!!busy || extraction.status === 'failed'}
                onClick={useExtraction}
              >
                Use extracted details <ArrowRight size={16} />
              </button>
              <p className="field-hint">
                Extraction can be wrong. Your confirmation and the team’s rules are still required.
              </p>
            </section>
          ) : (
            <section className="editor-guide">
              <span className="guide-symbol">
                <ScanLine size={23} />
              </span>
              <h2>A second pair of eyes.</h2>
              <p>
                Extract the receipt details, then check them against the original. You stay in
                control of what gets submitted.
              </p>
              <div className="editor-guide-rule">
                <Check size={15} />
                <span>No guessed amounts</span>
              </div>
              <div className="editor-guide-rule">
                <Check size={15} />
                <span>Sources you can inspect</span>
              </div>
              <div className="editor-guide-rule">
                <Check size={15} />
                <span>Missing details get a next step</span>
              </div>
            </section>
          )}
          <section className="recipient-card">
            <span className="eyebrow">YOUR PAYPAL RECIPIENT</span>
            <strong>{data.profile.confirmedAt ? data.profile.email : 'Not confirmed yet'}</strong>
            <p>
              {data.profile.confirmedAt
                ? 'This independently confirmed profile is used for reimbursements.'
                : 'Confirm your own PayPal email in Settings before a claim can be approved.'}
            </p>
            <Link href="/settings">
              Manage recipient <ArrowRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
      <div className="editor-actions">
        <span>
          <LockKeyhole size={14} />
          {detail ? `Saved · Version ${detail.version}` : 'Your receipt stays private'}
        </span>
        <div>
          <button
            type="button"
            className="button secondary"
            disabled={!!busy}
            onClick={() => void save(false)}
          >
            {busy === 'save' ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}Save
            draft
          </button>
          <button
            type="button"
            className="button primary"
            disabled={!!busy}
            onClick={() => {
              try {
                claimInput(fields);
                setSubmitOpen(true);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            {busy === 'submit' ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <>
                Submit claim <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </div>
      {submitOpen && (
        <Modal title="Submit this claim?" onClose={() => setSubmitOpen(false)}>
          <p className="modal-description">
            Your claim will be checked against the team’s current policy. Missing or unclear
            evidence will get a specific next step.
          </p>
          <div className="modal-summary">
            <span>{fields.merchant || 'Untitled expense'}</span>
            <strong>{money(claimInput(fields).amountMinor, fields.currency)}</strong>
            <small>
              {categoryLabels[fields.category]} · {fields.date || 'Date not confirmed'}
            </small>
          </div>
          {(!fields.fieldsConfirmed || !fields.paidConfirmed || !data.profile.confirmedAt) && (
            <div className="info-box">
              <Info size={17} />
              <span>
                Some confirmations are missing. You can submit now, but the claim cannot be approved
                or paid until they are resolved.
              </span>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => setSubmitOpen(false)}>
              Keep editing
            </button>
            <button type="button" className="button primary" onClick={() => void save(true)}>
              Submit for checks <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <span className="step-chevron" aria-hidden="true">
      /
    </span>
  );
}
function PlusIcon() {
  return <UploadCloud size={16} />;
}
