'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import type { Claim } from '@/lib/types';
import { categoryLabels, dateLabel, money, useApp } from './app-provider';
import { EmptyState, Loading, StatusBadge } from './ui';

type Filter = 'all' | 'attention' | 'progress' | 'complete';
function attention(claim: Claim) {
  return (
    ['needs_info', 'rejected'].includes(claim.reviewStatus) ||
    ['unknown', 'unclaimed', 'failed', 'returned', 'cancelled'].includes(claim.paymentStatus)
  );
}
function openReview(claim: Claim) {
  return (
    ['needs_review', 'needs_info', 'approved'].includes(claim.reviewStatus) &&
    claim.paymentStatus !== 'paid'
  );
}

export function ClaimsWorkspace({ reviewOnly = false }: { reviewOnly?: boolean }) {
  const { data, loading } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const source = useMemo(
    () => data?.claims.filter((claim) => !reviewOnly || openReview(claim)) ?? [],
    [data, reviewOnly],
  );
  const claims = useMemo(
    () =>
      source
        .filter((claim) => {
          const query = search.toLowerCase().trim();
          const matchesText =
            !query ||
            [claim.merchant, claim.purpose, claim.ownerName, claim.id]
              .join(' ')
              .toLowerCase()
              .includes(query);
          const date = claim.date ?? claim.createdAt.slice(0, 10);
          const matchesFilter =
            filter === 'all' ||
            (filter === 'attention' && attention(claim)) ||
            (filter === 'complete' && claim.paymentStatus === 'paid') ||
            (filter === 'progress' && !attention(claim) && claim.paymentStatus !== 'paid');
          return (
            matchesText &&
            matchesFilter &&
            (!category || claim.category === category) &&
            (!from || date >= from) &&
            (!to || date <= to)
          );
        })
        .sort((a, b) =>
          sort === 'amount'
            ? (b.amountMinor ?? 0) - (a.amountMinor ?? 0)
            : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [source, search, filter, category, from, to, sort],
  );
  if (loading || !data) return <Loading />;
  const reviewer = data.member.role === 'reviewer';
  if (reviewOnly && !reviewer)
    return (
      <EmptyState
        title="This workspace is for finance reviewers."
        description="You can see your own claims and their latest checks in My claims."
      >
        <Link href="/claims" className="button primary">
          Go to my claims
        </Link>
      </EmptyState>
    );
  const total = data.claims.reduce((sum, claim) => sum + (claim.amountMinor ?? 0), 0);
  const paid = data.claims.filter((claim) => claim.paymentStatus === 'paid');
  const inReview = data.claims.filter((claim) =>
    ['needs_review', 'checking'].includes(claim.reviewStatus),
  );
  const needsInfo = data.claims.filter(attention);
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: reviewOnly ? 'All open' : 'All claims', count: source.length },
    { key: 'attention', label: 'Needs attention', count: source.filter(attention).length },
    {
      key: 'progress',
      label: 'In progress',
      count: source.filter((claim) => !attention(claim) && claim.paymentStatus !== 'paid').length,
    },
    ...(!reviewOnly
      ? [
          {
            key: 'complete' as const,
            label: 'Completed',
            count: source.filter((claim) => claim.paymentStatus === 'paid').length,
          },
        ]
      : []),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{reviewOnly ? 'FINANCE WORKSPACE' : 'REIMBURSEMENTS'}</span>
          <h1>
            {reviewOnly ? 'A clearer review queue.' : reviewer ? 'Team claims' : 'Your claims'}
          </h1>
          <p>
            {reviewOnly
              ? 'See the evidence, resolve the exceptions, and keep things moving.'
              : reviewer
                ? 'Every team expense, from first receipt to final payment.'
                : 'A home for your receipts. A clear next step for every expense.'}
          </p>
        </div>
        <div className="heading-actions">
          <a href="/api/export" download className="button secondary">
            <ArrowDownToLine size={16} />
            Export CSV
          </a>
          {!reviewer && (
            <Link href="/claims/new" className="button primary">
              <Plus size={18} />
              New claim
            </Link>
          )}
        </div>
      </div>
      <div className="summary-strip">
        <div className="summary-cell">
          <span className="summary-icon blue">
            <Wallet size={20} strokeWidth={1.6} />
          </span>
          <div>
            <span className="summary-label">Total claimed</span>
            <strong>{money(total)}</strong>
            <small>
              Across {data.claims.length} {data.claims.length === 1 ? 'claim' : 'claims'}
            </small>
          </div>
        </div>
        <div className="summary-cell">
          <span className="summary-icon sand">
            <Clock3 size={20} strokeWidth={1.6} />
          </span>
          <div>
            <span className="summary-label">In review</span>
            <strong>
              {inReview.length}
              <span className="summary-unit">{inReview.length === 1 ? 'claim' : 'claims'}</span>
            </strong>
            <small>Awaiting a decision</small>
          </div>
        </div>
        <div className="summary-cell">
          <span className="summary-icon mint">
            <CheckCheck size={21} strokeWidth={1.6} />
          </span>
          <div>
            <span className="summary-label">
              {data.mode === 'demo' ? 'Simulated paid' : 'Reimbursed'}
            </span>
            <strong>{money(paid.reduce((sum, claim) => sum + (claim.amountMinor ?? 0), 0))}</strong>
            <small>
              {paid.length} {paid.length === 1 ? 'completed payment' : 'completed payments'}
            </small>
          </div>
        </div>
      </div>
      {needsInfo.length > 0 && !reviewOnly && (
        <div className="attention-banner">
          <span className="attention-symbol">
            <FileText size={18} />
          </span>
          <div>
            <strong>
              {needsInfo.length} {needsInfo.length === 1 ? 'claim needs' : 'claims need'} a closer
              look
            </strong>
            <span>
              {reviewer
                ? 'Open a claim to check the evidence and next steps.'
                : 'Add the missing details or check a payment update.'}
            </span>
          </div>
          <button className="text-button" onClick={() => setFilter('attention')}>
            View claims <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="claims-layout">
        <section className="claims-panel panel" aria-label="Claims list">
          <div
            className="tabs"
            role="tablist"
            aria-label="Filter claims"
            onKeyDown={(event) => {
              const buttons = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
              ];
              const current = buttons.indexOf(event.target as HTMLButtonElement);
              if (current < 0) return;
              const next =
                event.key === 'ArrowRight'
                  ? (current + 1) % buttons.length
                  : event.key === 'ArrowLeft'
                    ? (current - 1 + buttons.length) % buttons.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? buttons.length - 1
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                setFilter(tabs[next].key);
                buttons[next].focus();
              }
            }}
          >
            {tabs.map((tab) => (
              <button
                role="tab"
                id={`claims-tab-${tab.key}`}
                aria-controls="claims-results"
                tabIndex={filter === tab.key ? 0 : -1}
                aria-selected={filter === tab.key}
                className={filter === tab.key ? 'active' : ''}
                onClick={() => setFilter(tab.key)}
                key={tab.key}
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="table-tools">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search claims"
                placeholder="Search merchant, purpose or claim…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <details className="filter-popover">
              <summary className="button secondary small">
                <SlidersHorizontal size={15} />
                Filters{(category || from || to) && <span className="filter-active" />}
              </summary>
              <div className="filter-content">
                <label>
                  Category
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">All categories</option>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Expense date from
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </label>
                <label>
                  Expense date to
                  <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setCategory('');
                    setFrom('');
                    setTo('');
                  }}
                >
                  Clear filters
                </button>
              </div>
            </details>
            <select
              className="sort-select"
              aria-label="Sort claims"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Latest activity</option>
              <option value="amount">Highest amount</option>
            </select>
          </div>
          <div id="claims-results" role="tabpanel" aria-labelledby={`claims-tab-${filter}`}>
            {claims.length === 0 ? (
              <EmptyState
                title={
                  source.length
                    ? 'No claims match these filters.'
                    : 'Your next expense starts here.'
                }
                description={
                  source.length
                    ? 'Try a different merchant or clear your date and category filters.'
                    : reviewOnly
                      ? 'Claims that need a decision will appear here.'
                      : 'Add a receipt and tell us what it was for. We’ll show you what happens next.'
                }
              >
                {!reviewer && !source.length && (
                  <Link href="/claims/new" className="button primary">
                    <Plus size={17} />
                    Create a claim
                  </Link>
                )}
              </EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="claims-table">
                  <thead>
                    <tr>
                      <th>Expense</th>
                      <th>Amount</th>
                      <th>Review</th>
                      <th>Payment</th>
                      <th>
                        <span className="sr-only">Open claim</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr key={claim.id}>
                        <td>
                          <Link href={`/claims/${claim.id}`} className="expense-link">
                            <span className={`merchant-icon category-${claim.category}`}>
                              {claim.merchant ? (
                                claim.merchant
                                  .split(' ')
                                  .map((part) => part[0])
                                  .slice(0, 2)
                                  .join('')
                              ) : (
                                <FileText size={19} />
                              )}
                            </span>
                            <span className="expense-info">
                              <strong>{claim.merchant || 'Untitled expense'}</strong>
                              <span>
                                {categoryLabels[claim.category]}{' '}
                                <span className="inline-dot">·</span> {dateLabel(claim.date)}
                                {reviewer && (
                                  <>
                                    {' '}
                                    <span className="inline-dot">·</span> {claim.ownerName}
                                  </>
                                )}
                              </span>
                              <small>{claim.purpose || 'Add a purpose to this draft'}</small>
                            </span>
                          </Link>
                        </td>
                        <td className="amount-cell">
                          {money(claim.amountMinor, claim.currency)}
                          <small>GBP</small>
                        </td>
                        <td data-label="Review">
                          <StatusBadge status={claim.reviewStatus} />
                        </td>
                        <td data-label="Payment">
                          <StatusBadge status={claim.paymentStatus} payment />
                        </td>
                        <td>
                          <Link
                            className="table-open"
                            href={`/claims/${claim.id}`}
                            aria-label={`Open ${claim.merchant || 'untitled'} claim`}
                          >
                            <ChevronRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="table-footer">
            <span>
              {claims.length} of {source.length} {source.length === 1 ? 'claim' : 'claims'}
            </span>
            <span>
              <ShieldCheck size={13} />
              {reviewer ? 'Your organization only' : 'Only visible to you and finance'}
            </span>
          </div>
        </section>
        <aside className="claims-aside">
          <section className="policy-receipt">
            <div className="receipt-hole" />
            <div className="receipt-caption">
              <ShieldCheck size={17} />
              <span>YOUR TEAM POLICY</span>
            </div>
            <h2>
              A little guidance.
              <br />
              Less back-and-forth.
            </h2>
            <p>Clear receipts and a short purpose help every claim find its next step.</p>
            <div className="receipt-rule">
              <span>Single-claim auto limit</span>
              <strong>{money(data.policy.singleLimitMinor)}</strong>
            </div>
            <div className="receipt-rule">
              <span>Monthly auto limit</span>
              <strong>{money(data.policy.monthlyLimitMinor)}</strong>
            </div>
            <div className="receipt-rule">
              <span>Submit within</span>
              <strong>{data.policy.maxAgeDays} days</strong>
            </div>
            <div className="receipt-dashed" />
            <div className="auto-payment-note">
              <span className={`tiny-toggle ${data.policy.autoPaymentEnabled ? 'on' : ''}`} />
              <div>
                <strong>Automatic payments {data.policy.autoPaymentEnabled ? 'on' : 'off'}</strong>
                <span>
                  {data.policy.autoPaymentEnabled
                    ? 'Only fully checked, eligible claims.'
                    : 'Finance reviews before payment.'}
                </span>
              </div>
            </div>
            <Link href="/settings" className="receipt-link">
              View policy & settings <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="how-it-works">
            <span className="eyebrow">A TRACEABLE PROCESS</span>
            <div>
              <span>
                <FileText size={17} />
              </span>
              <p>
                <strong>Keep the original</strong>Upload your receipt and confirm the details.
              </p>
            </div>
            <div>
              <span>
                <ShieldCheck size={17} />
              </span>
              <p>
                <strong>Know what’s checked</strong>See the evidence behind each decision.
              </p>
            </div>
            <div>
              <span>
                <CircleCheck size={17} />
              </span>
              <p>
                <strong>Follow your payment</strong>Approval and payment stay separate.
              </p>
            </div>
          </section>
        </aside>
      </div>
      <div className="workspace-note">
        <Check size={14} />
        <span>
          {data.mode === 'demo'
            ? 'You’re viewing synthetic sample claims. Uploads stay in this local workspace.'
            : 'Original receipts are private. Your finance team can review claims within this workspace.'}
        </span>
      </div>
    </>
  );
}
