'use client';

/* Private receipt previews must use the authenticated endpoint directly; image optimization cannot forward the session. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  History,
  Info,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import type { ClaimDetail, Finding, RecipientProfile } from '@/lib/types';
import {
  api,
  categoryLabels,
  dateLabel,
  errorMessage,
  money,
  sourceFieldLabel,
  useApp,
} from './app-provider';
import { ClaimEditor } from './claim-editor';
import { PdfReceiptPreview } from './receipt-preview';
import { EmptyState, ErrorBox, Loading, Modal, StatusBadge } from './ui';

type DetailData = ClaimDetail & { recipientProfile?: RecipientProfile };
const nextStep: Record<string, { title: string; text: string }> = {
  draft: {
    title: 'Ready when you are.',
    text: 'Add your evidence, confirm the expense details, and submit for checks.',
  },
  checking: {
    title: 'Your receipt is being checked.',
    text: 'Your claim is saved. Check back here for the result and next steps.',
  },
  needs_info: {
    title: 'A few more details will help.',
    text: 'Review the checks below, add the missing evidence, then submit an updated version.',
  },
  needs_review: {
    title: 'With finance for a closer look.',
    text: 'The checks below explain why this claim needs a person’s decision.',
  },
  approved: {
    title: 'Approved, with payment tracked separately.',
    text: 'Your confirmed amount and recipient are checked again before a payment is sent.',
  },
  rejected: {
    title: 'Finance declined this claim.',
    text: 'The decision and its reason are recorded in the activity below.',
  },
};

export function ClaimDetailView({ id }: { id: string }) {
  const { data, reload, notify } = useApp();
  const [claim, setClaim] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<
    'approve' | 'request_info' | 'reject' | 'payment' | 'reopen' | null
  >(null);
  const [selectedAttachment, setSelectedAttachment] = useState('');
  const [activity, setActivity] = useState<'timeline' | 'versions'>('timeline');
  const load = useCallback(async () => {
    try {
      const next = await api<DetailData>(`/api/claims/${id}`);
      setClaim(next);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    api<DetailData>(`/api/claims/${id}`)
      .then((next) => {
        if (active) {
          setClaim(next);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (loading) return <Loading label="Loading the receipt and its paper trail…" />;
  if (!claim || !data)
    return (
      <>
        <ErrorBox message={error} />
        <EmptyState
          title="This claim isn’t available."
          description="Check the link or return to the claims you have permission to view."
        >
          <Link href="/claims" className="button primary">
            Back to claims
          </Link>
        </EmptyState>
      </>
    );
  const reviewer = data.member.role === 'reviewer';
  const owner = data.member.id === claim.ownerId;
  const unsentCancellation =
    claim.paymentStatus === 'cancelled' &&
    claim.payment?.status === 'cancelled' &&
    claim.payment.sentAt === null;
  const locked = !unsentCancellation && [
    'processing',
    'unknown',
    'unclaimed',
    'paid',
    'failed',
    'returned',
    'cancelled',
  ].includes(claim.paymentStatus);
  const editable =
    owner && !locked && claim.reviewStatus !== 'checking' && claim.reviewStatus !== 'rejected';
  const canReview =
    reviewer && !owner && ['needs_review', 'needs_info'].includes(claim.reviewStatus) && !locked;
  const canPay =
    reviewer &&
    claim.reviewStatus === 'approved' &&
    (['not_started', 'queued'].includes(claim.paymentStatus) || unsentCancellation);
  const canSync = reviewer && claim.paymentIntentId && !!claim.payment?.sentAt;
  const canReopen =
    reviewer &&
    ['failed', 'cancelled'].includes(claim.paymentStatus) &&
    !!claim.payment?.sentAt &&
    !!claim.payment?.lastReconciledAt;
  const payment = claim.payment;
  const recipient = payment?.recipientEmail ?? claim.recipientProfile?.email;
  const receipt =
    claim.attachments.find((file) => file.id === selectedAttachment) ?? claim.attachments[0];
  const passed = claim.findings.filter((finding) => finding.outcome === 'pass').length;
  const step = nextStep[claim.reviewStatus];
  function showSource(attachmentId: string) {
    setSelectedAttachment(attachmentId);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById('original-evidence')
      ?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  }
  async function decide() {
    if (!claim || !action) return;
    if (action !== 'payment' && reason.trim().length < 3) {
      setError('Add a specific reason before recording a finance decision.');
      setAction(null);
      return;
    }
    setBusy(action);
    setError('');
    try {
      const next =
        action === 'payment'
          ? await api<DetailData>(`/api/claims/${claim.id}/payment`, {
              method: 'POST',
              body: JSON.stringify({ expectedVersion: claim.version }),
            })
          : action === 'reopen'
            ? await api<DetailData>(`/api/claims/${claim.id}/reopen`, {
                method: 'POST',
                body: JSON.stringify({ expectedVersion: claim.version, reason: reason.trim() }),
              })
            : await api<DetailData>(`/api/claims/${claim.id}/review`, {
                method: 'POST',
                body: JSON.stringify({
                  expectedVersion: claim.version,
                  decision: action,
                  reason: reason.trim(),
                }),
              });
      setClaim(next);
      setReason('');
      setAction(null);
      await reload();
      notify(
        action === 'payment'
          ? 'Payment attempt recorded. Synchronize to verify the individual result.'
          : action === 'reopen'
            ? 'Claim reopened. The applicant must confirm a new version before review.'
            : action === 'approve'
              ? 'Approval recorded for this version.'
              : action === 'request_info'
                ? 'Request for information recorded.'
                : 'Finance decision recorded.',
      );
    } catch (err) {
      setError(errorMessage(err));
      setAction(null);
    } finally {
      setBusy('');
    }
  }
  async function sync() {
    if (!claim) return;
    setBusy('sync');
    setError('');
    try {
      const next = await api<DetailData>(`/api/claims/${claim.id}/sync`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setClaim(next);
      await reload();
      notify('The existing payment was checked. No new payment was created.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }
  if (editing)
    return (
      <>
        <button className="back-link" type="button" onClick={() => setEditing(false)}>
          <ArrowLeft size={16} />
          Back to claim
        </button>
        <div className="page-heading">
          <div>
            <span className="eyebrow">UPDATE & RESUBMIT</span>
            <h1>Keep the paper trail together.</h1>
            <p>Your original evidence and earlier versions stay in the history.</p>
          </div>
        </div>
        <ClaimEditor
          key={claim.version}
          initial={claim}
          onSaved={(next) => {
            setClaim(next);
            setEditing(false);
            void load();
          }}
        />
      </>
    );
  return (
    <>
      <Link href={reviewer ? '/review' : '/claims'} className="back-link">
        <ArrowLeft size={16} />
        {reviewer ? 'Back to review queue' : 'Back to claims'}
      </Link>
      <div className="page-heading detail-heading">
        <div>
          <span className="eyebrow">
            CLAIM {claim.id.slice(0, 8).toUpperCase()} <span className="inline-dot">·</span> VERSION{' '}
            {claim.version}
          </span>
          <h1>{claim.merchant || 'Untitled expense'}</h1>
          <p>
            {categoryLabels[claim.category]} <span className="inline-dot">·</span> {claim.ownerName}{' '}
            <span className="inline-dot">·</span>{' '}
            {claim.firstSubmittedAt
              ? `Submitted ${dateLabel(claim.firstSubmittedAt)}`
              : `Created ${dateLabel(claim.createdAt)}`}
          </p>
        </div>
        <div className="heading-actions">
          {editable && (
            <button type="button" className="button secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              {claim.reviewStatus === 'draft' ? 'Continue draft' : 'Update claim'}
            </button>
          )}
          <button
            type="button"
            className="icon-button refresh-detail"
            aria-label="Refresh claim"
            onClick={() => void load()}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className={`claim-next-step next-${claim.reviewStatus}`}>
        <span className="next-step-icon">
          {claim.reviewStatus === 'approved' ? (
            <CheckCircle2 size={22} />
          ) : claim.reviewStatus === 'needs_info' ? (
            <Info size={22} />
          ) : claim.reviewStatus === 'rejected' ? (
            <X size={22} />
          ) : (
            <ClipboardCheck size={22} />
          )}
        </span>
        <div>
          <strong>{step.title}</strong>
          <p>{step.text}</p>
        </div>
        {editable && claim.reviewStatus === 'needs_info' && (
          <button className="button secondary small" onClick={() => setEditing(true)}>
            Add information <ArrowRight size={15} />
          </button>
        )}
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel claim-overview">
            <div className="claim-overview-top">
              <div>
                <span className="eyebrow">REQUESTED REIMBURSEMENT</span>
                <strong className="claim-amount">{money(claim.amountMinor, claim.currency)}</strong>
              </div>
              <span className="currency-chip">{claim.currency}</span>
            </div>
            <div className="dual-status">
              <div>
                <span>Review status</span>
                <StatusBadge status={claim.reviewStatus} />
              </div>
              <div>
                <span>Payment status</span>
                <StatusBadge status={claim.paymentStatus} payment />
              </div>
            </div>
            <dl className="claim-facts">
              <div>
                <dt>Expense date</dt>
                <dd>{claim.date ? dateLabel(claim.date) : 'Not confirmed'}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{categoryLabels[claim.category]}</dd>
              </div>
              <div className="full-width">
                <dt>Purpose</dt>
                <dd>{claim.purpose || 'No purpose provided'}</dd>
              </div>
              <div className="full-width">
                <dt>Payment evidence</dt>
                <dd>{claim.paymentNote || 'No explanation provided'}</dd>
              </div>
              {claim.partialExplanation && (
                <div className="full-width">
                  <dt>Partial reimbursement / context</dt>
                  <dd>{claim.partialExplanation}</dd>
                </div>
              )}
            </dl>
            <div className="confirmation-row">
              <span className={claim.fieldsConfirmed ? 'confirmed' : ''}>
                {claim.fieldsConfirmed ? <Check size={14} /> : <Clock3 size={14} />}
                {claim.fieldsConfirmed ? 'Expense details confirmed' : 'Details need confirmation'}
              </span>
              <span className={claim.paidConfirmed ? 'confirmed' : ''}>
                {claim.paidConfirmed ? <Check size={14} /> : <Clock3 size={14} />}
                {claim.paidConfirmed ? 'Applicant confirms paid' : 'Payment evidence unconfirmed'}
              </span>
            </div>
          </section>
          <section className="panel checks-panel">
            <div className="panel-title">
              <div>
                <ShieldCheck size={20} />
                <h2>Checks & next steps</h2>
              </div>
              <span>
                {passed} of {claim.findings.length} passed
              </span>
            </div>
            {claim.findings.length ? (
              <div className="findings-list">
                {claim.findings.map((finding, index) => (
                  <FindingCard
                    key={`${finding.code}-${index}`}
                    finding={finding}
                    onSource={showSource}
                  />
                ))}
              </div>
            ) : (
              <div className="checks-empty">
                <ScanLine size={24} />
                <p>
                  {claim.reviewStatus === 'draft'
                    ? 'Submit this draft to run the team’s policy checks.'
                    : 'No check results are available for this version yet.'}
                </p>
              </div>
            )}
            {claim.extraction && (
              <div className="extraction-provenance">
                <ScanLine size={14} />
                <span>
                  {claim.extraction.provider === 'demo'
                    ? 'Prepared sample extraction'
                    : 'AI-assisted extraction'}{' '}
                  ·{' '}
                  {claim.extraction.status === 'failed'
                    ? 'Could not read reliably'
                    : 'Applicant confirmation required'}
                </span>
              </div>
            )}
          </section>
          {canReview && (
            <section className="panel review-decision">
              <div className="section-heading compact">
                <ClipboardCheck size={21} />
                <div>
                  <h2>Your finance decision</h2>
                  <p>Review the original evidence and all findings before deciding.</p>
                </div>
              </div>
              <label>
                Decision reason
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain the decision, including how any policy exceptions were resolved."
                  maxLength={2000}
                />
              </label>
              <div className="review-actions">
                <button
                  className="button danger-outline"
                  type="button"
                  disabled={!!busy || reason.trim().length < 3}
                  onClick={() => setAction('reject')}
                >
                  Decline
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={!!busy || reason.trim().length < 3}
                  onClick={() => setAction('request_info')}
                >
                  Request information
                </button>
                <button
                  className="button primary"
                  type="button"
                  disabled={
                    !!busy ||
                    reason.trim().length < 3 ||
                    claim.findings.some((finding) => ['info', 'block'].includes(finding.outcome))
                  }
                  onClick={() => setAction('approve')}
                >
                  <Check size={16} />
                  Approve claim
                </button>
              </div>
              <p className="field-note">
                <LockKeyhole size={13} />A decision applies to this version. Changing details
                requires a new review.
              </p>
            </section>
          )}
          <section className="panel payment-panel">
            <div className="panel-title">
              <div>
                <Wallet size={20} />
                <h2>{data.mode === 'demo' ? 'Simulated payment' : 'PayPal Sandbox payment'}</h2>
              </div>
              <StatusBadge status={claim.paymentStatus} payment />
            </div>
            <div className="payment-content">
              <p>{paymentText(claim.paymentStatus, data.mode === 'demo')}</p>
              {payment && (
                <dl className="payment-facts">
                  <div>
                    <dt>Recipient</dt>
                    <dd>{payment.recipientEmail}</dd>
                  </div>
                  <div>
                    <dt>Authorized amount</dt>
                    <dd>{money(payment.amountMinor, payment.currency)}</dd>
                  </div>
                  <div>
                    <dt>Payment reference</dt>
                    <dd className="mono">{payment.senderBatchId}</dd>
                  </div>
                  {payment.transactionId && (
                    <div>
                      <dt>Transaction</dt>
                      <dd className="mono">{payment.transactionId}</dd>
                    </div>
                  )}
                  {payment.providerStatus && (
                    <div>
                      <dt>Provider status</dt>
                      <dd>{payment.providerStatus}</dd>
                    </div>
                  )}
                  {payment.lastReconciledAt && (
                    <div>
                      <dt>Last checked</dt>
                      <dd>{dateLabel(payment.lastReconciledAt, true)}</dd>
                    </div>
                  )}
                </dl>
              )}
              {claim.approval && (
                <div className="approval-note">
                  <ShieldCheck size={15} />
                  <span>
                    {claim.approval.kind === 'auto' ? 'Policy-approved' : 'Finance-approved'} ·
                    Claim v{claim.approval.claimVersion} · Policy v{claim.approval.policyVersion} ·
                    Recipient v{claim.approval.profileVersion}
                  </span>
                </div>
              )}
              {canPay && (
                <button
                  type="button"
                  className="button primary"
                  disabled={!!busy}
                  onClick={() => setAction('payment')}
                >
                  <Wallet size={16} />
                  {data.mode === 'demo' ? 'Simulate approved payment' : 'Send Sandbox payment'}
                </button>
              )}
              {canSync && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => void sync()}
                >
                  {busy === 'sync' ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Synchronize existing payment
                </button>
              )}
              {canReopen && (
                <div className="recovery-section">
                  <h3>Authorize a correction</h3>
                  <p>
                    The previous payment is verified as failed or cancelled. Reopening creates an
                    editable claim; the applicant must confirm it again before a fresh approval.
                  </p>
                  <label>
                    Reason for reopening
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Explain the verified failure and the correction needed."
                      maxLength={2000}
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={!!busy || reason.trim().length < 3}
                    onClick={() => setAction('reopen')}
                  >
                    Reopen for correction <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </section>
          <section className="panel activity-panel">
            <div className="activity-tabs">
              <button
                className={activity === 'timeline' ? 'active' : ''}
                onClick={() => setActivity('timeline')}
              >
                <History size={17} />
                Activity
              </button>
              <button
                className={activity === 'versions' ? 'active' : ''}
                onClick={() => setActivity('versions')}
              >
                <FileText size={17} />
                Versions <span>{claim.versions.length}</span>
              </button>
            </div>
            {activity === 'timeline' ? (
              <ol className="timeline">
                {[...claim.timeline]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((event) => (
                    <li key={event.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{event.message}</strong>
                        <span>
                          {data.members.find((member) => member.id === event.actorId)?.name ??
                            (event.actorId === 'system'
                              ? 'Carry checks'
                              : 'Recorded by the system')}{' '}
                          <span className="inline-dot">·</span> {dateLabel(event.createdAt, true)}{' '}
                          <span className="inline-dot">·</span> v{event.version}
                        </span>
                      </div>
                    </li>
                  ))}
                {!claim.timeline.length && (
                  <li>
                    <span className="timeline-dot" />
                    <div>
                      <strong>No activity recorded yet.</strong>
                    </div>
                  </li>
                )}
              </ol>
            ) : (
              <div className="version-list">
                {[...claim.versions]
                  .sort((a, b) => b.version - a.version)
                  .map((version) => (
                    <details key={version.version}>
                      <summary>
                        <span>
                          Version {version.version}
                          {version.version === claim.version && <small>Current</small>}
                        </span>
                        <span>{dateLabel(version.createdAt, true)}</span>
                      </summary>
                      <dl>
                        <div>
                          <dt>Merchant</dt>
                          <dd>{version.snapshot.merchant || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Amount</dt>
                          <dd>{money(version.snapshot.amountMinor, version.snapshot.currency)}</dd>
                        </div>
                        <div>
                          <dt>Purpose</dt>
                          <dd>{version.snapshot.purpose || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Evidence files</dt>
                          <dd>{version.snapshot.attachmentIds.length}</dd>
                        </div>
                      </dl>
                    </details>
                  ))}
              </div>
            )}
          </section>
        </div>
        <aside className="detail-evidence">
          <section id="original-evidence" className="panel evidence-panel">
            <div className="panel-title">
              <div>
                <FileText size={19} />
                <h2>Original evidence</h2>
              </div>
              <LockKeyhole size={14} />
            </div>
            {receipt ? (
              <>
                <div className="evidence-file-tabs">
                  {claim.attachments.map((file, index) => (
                    <button
                      type="button"
                      key={file.id}
                      className={receipt.id === file.id ? 'active' : ''}
                      onClick={() => setSelectedAttachment(file.id)}
                      title={file.name}
                    >
                      File {index + 1}
                    </button>
                  ))}
                </div>
                <div>
                  {receipt.mediaType === 'application/pdf' ? (
                    <PdfReceiptPreview key={receipt.id} attachment={receipt} />
                  ) : (
                    <div className="receipt-preview">
                      <img
                        alt={`Original receipt: ${receipt.name}`}
                        src={`/api/attachments/${receipt.id}`}
                      />
                    </div>
                  )}
                </div>
                <div className="evidence-caption">
                  <span>{receipt.name}</span>
                  <a href={`/api/attachments/${receipt.id}`} target="_blank" rel="noreferrer">
                    Open original
                    <ExternalLink size={13} />
                  </a>
                </div>
              </>
            ) : (
              <div className="no-evidence">
                <div className="no-evidence-paper">
                  <FileText size={30} strokeWidth={1.3} />
                  <span>NO RECEIPT ATTACHED</span>
                  <div />
                  <div />
                  <div />
                </div>
                <p>
                  {owner
                    ? 'Add the original receipt or payment evidence to this claim.'
                    : 'Ask the applicant to attach the original receipt or payment evidence.'}
                </p>
                {editable && (
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => setEditing(true)}
                  >
                    Add evidence
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </section>
          {claim.extraction && (
            <section className="evidence-extraction">
              <span className="eyebrow">WHAT THE RECEIPT SAYS</span>
              <dl>
                <div>
                  <dt>Merchant</dt>
                  <dd>{claim.extraction.merchant ?? 'Unclear'}</dd>
                </div>
                <div>
                  <dt>Receipt date</dt>
                  <dd>{claim.extraction.date ?? 'Unclear'}</dd>
                </div>
                <div>
                  <dt>Receipt total</dt>
                  <dd>{money(claim.extraction.totalMinor, claim.extraction.currency || 'GBP')}</dd>
                </div>
              </dl>
              {claim.extraction.issues.map((issue, index) => (
                <p key={index}>
                  <Info size={14} />
                  {issue}
                </p>
              ))}
              {claim.extraction.sources.map((source, index) => (
                <button
                  type="button"
                  className="source-quote source-button"
                  key={index}
                  onClick={() => setSelectedAttachment(source.attachmentId)}
                >
                  <span>
                    {sourceFieldLabel(source.field)} · Page {source.page}
                  </span>
                  <blockquote>“{source.quote}”</blockquote>
                </button>
              ))}
            </section>
          )}
          <div className="evidence-boundary">
            <ShieldCheck size={17} />
            <p>
              Checks explain the evidence and policy. They do not verify tax validity or prove that
              an expense occurred.
            </p>
          </div>
        </aside>
      </div>
      {action && (
        <Modal
          title={
            action === 'payment'
              ? data.mode === 'demo'
                ? 'Simulate this payment?'
                : 'Send this Sandbox payment?'
              : action === 'reopen'
                ? 'Reopen this claim for correction?'
                : action === 'approve'
                  ? 'Approve this version?'
                  : action === 'reject'
                    ? 'Decline this claim?'
                    : 'Request more information?'
          }
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <p className="modal-description">
            {action === 'payment'
              ? 'The server will recheck this approval, the recipient profile and the current policy before using the existing payment intent.'
              : action === 'reopen'
                ? 'The verified previous payment remains in history. The applicant must confirm the corrected claim and recipient before finance approves a new version. This does not send another payment.'
                : action === 'approve'
                  ? 'Your decision applies to the exact details below. Sending a payment is a separate action.'
                  : 'Your reason will be recorded in the claim’s activity and visible to the applicant.'}
          </p>
          <div className="modal-summary">
            <span>
              {claim.merchant || 'Untitled expense'} · Version {claim.version}
            </span>
            <strong>{money(claim.amountMinor, claim.currency)}</strong>
            <small>
              {claim.ownerName}
              {action === 'payment' && (
                <> → {recipient || 'Recipient must be verified by the server'}</>
              )}
            </small>
          </div>
          {action !== 'payment' && (
            <div className="decision-reason">
              <span>YOUR REASON</span>
              <p>{reason}</p>
            </div>
          )}
          {action === 'payment' && !recipient && (
            <div className="info-box">
              <Info size={17} />
              <span>
                The recipient preview is not available. Refresh this claim before sending a payment.
              </span>
            </div>
          )}
          {action === 'payment' && data.mode === 'demo' && (
            <p className="field-note">
              <ShieldCheck size={14} />
              This is a simulation. No PayPal request or real payment will be made.
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={!!busy}
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`button ${action === 'reject' ? 'danger' : 'primary'}`}
              disabled={!!busy || (action === 'payment' && !recipient)}
              onClick={() => void decide()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : action === 'payment' ? (
                data.mode === 'demo' ? (
                  'Confirm simulation'
                ) : (
                  'Confirm Sandbox payment'
                )
              ) : action === 'reopen' ? (
                'Reopen for correction'
              ) : action === 'approve' ? (
                'Confirm approval'
              ) : action === 'reject' ? (
                'Confirm decline'
              ) : (
                'Record request'
              )}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function FindingCard({ finding, onSource }: { finding: Finding; onSource: (id: string) => void }) {
  return (
    <div className={`finding finding-${finding.outcome}`}>
      <span className="finding-icon">
        {finding.outcome === 'pass' ? (
          <Check size={16} />
        ) : finding.outcome === 'block' ? (
          <AlertCircle size={17} />
        ) : finding.outcome === 'manual' ? (
          <ClipboardCheck size={17} />
        ) : (
          <Info size={17} />
        )}
      </span>
      <div className="finding-body">
        <div className="finding-heading">
          <h3>{finding.title}</h3>
          <span>
            {finding.outcome === 'pass'
              ? 'Passed'
              : finding.outcome === 'manual'
                ? 'Finance review'
                : finding.outcome === 'block'
                  ? 'Blocked'
                  : 'Information needed'}
          </span>
        </div>
        <p>{finding.detail}</p>
        {finding.sources.map((source, index) => (
          <button
            className="finding-source"
            key={index}
            type="button"
            onClick={() => onSource(source.attachmentId)}
          >
            Page {source.page} · “{source.quote}” <ExternalLink size={11} />
          </button>
        ))}
        {finding.outcome !== 'pass' && (
          <div className="finding-next">
            <ArrowRight size={13} />
            <span>{finding.nextStep}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function paymentText(status: string, demo: boolean) {
  const prefix = demo ? 'In this local simulation, ' : '';
  switch (status) {
    case 'queued':
      return `${prefix}the approved payment is queued. It has not been confirmed as paid.`;
    case 'processing':
      return `${prefix}the payment request was accepted. The individual payment still needs to be checked before it can be marked paid.`;
    case 'unknown':
      return 'The outcome is not yet known. Synchronize the existing payment; do not create another claim or payment attempt.';
    case 'unclaimed':
      return 'The recipient has not claimed this payment. Finance can check the existing transaction and help confirm the receiving account.';
    case 'paid':
      return demo
        ? 'The simulated item result is paid. This is test data; no money moved.'
        : 'The individual payment was verified as completed. The transaction record is kept below.';
    case 'failed':
      return 'The payment did not complete. Finance should review the verified failure before deciding the next step. No automatic repayment will be made.';
    case 'returned':
      return 'The payment was returned. The original payment record remains; finance needs to review the return before taking further action.';
    case 'cancelled':
      return 'The payment is cancelled. Its history is retained and no new payment will be sent automatically.';
    default:
      return 'No payment has been sent. An approved, current claim and a separately confirmed recipient are required before payment.';
  }
}
