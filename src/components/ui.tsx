'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertCircle, ArrowRight, Check, Clock3, FileText, LoaderCircle, X } from 'lucide-react';
import type { PaymentStatus, ReviewStatus } from '@/lib/types';

export const reviewLabels: Record<ReviewStatus, string> = {
  draft: 'Draft',
  checking: 'Checking',
  needs_info: 'Needs information',
  needs_review: 'In review',
  approved: 'Approved',
  rejected: 'Declined',
};
export const paymentLabels: Record<PaymentStatus, string> = {
  not_started: 'Not started',
  queued: 'Queued',
  processing: 'Processing',
  unknown: 'Awaiting confirmation',
  unclaimed: 'Unclaimed',
  paid: 'Paid',
  failed: 'Failed',
  returned: 'Returned',
  cancelled: 'Cancelled',
};
export function StatusBadge({
  status,
  payment = false,
}: {
  status: ReviewStatus | PaymentStatus;
  payment?: boolean;
}) {
  const label = payment
    ? paymentLabels[status as PaymentStatus]
    : reviewLabels[status as ReviewStatus];
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {label ?? status}
    </span>
  );
}
export function Loading({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FileText size={27} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function StepPill({
  done,
  current,
  children,
}: {
  done?: boolean;
  current?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`step-pill ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
      {done ? <Check size={15} /> : <Clock3 size={15} />}
      {children}
    </span>
  );
}
export function ArrowLink({ children }: { children: React.ReactNode }) {
  return (
    <span className="arrow-link">
      {children}
      <ArrowRight size={16} />
    </span>
  );
}
