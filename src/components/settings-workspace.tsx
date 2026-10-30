'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Settings2,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { Category, Policy, PolicyInput, RecipientProfile } from '@/lib/types';
import { api, categoryLabels, errorMessage, money, useApp } from './app-provider';
import { ErrorBox, Loading, Modal } from './ui';

export function SettingsWorkspace() {
  const { data, loading } = useApp();
  if (loading || !data) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE SETTINGS</span>
          <h1>Good rules. Clear expectations.</h1>
          <p>Your recipient details and the policy behind each reimbursement.</p>
        </div>
        <span className="private-label">
          <ShieldCheck size={16} />
          {data.organization.name}
        </span>
      </div>
      <div className="settings-layout">
        <div className="settings-main">
          <ProfileSettings key={`profile-${data.profile.version}`} profile={data.profile} />
          <PolicySettings
            key={`policy-${data.policy.version}`}
            policy={data.policy}
            canEdit={data.member.role === 'reviewer'}
          />
        </div>
        <aside className="settings-aside">
          <section className="policy-receipt">
            <div className="receipt-hole" />
            <div className="receipt-caption">
              <ShieldCheck size={17} />
              <span>AUTOMATION WITH BOUNDARIES</span>
            </div>
            <h2>
              Fast when it’s clear.
              <br />
              Human when it isn’t.
            </h2>
            <p>
              Automatic approval requires every check to pass, a confirmed recipient and an enabled
              team policy.
            </p>
            <div className="settings-principle">
              <Check size={15} />
              <span>AI reads the evidence. Application rules make the routing decision.</span>
            </div>
            <div className="settings-principle">
              <Check size={15} />
              <span>Unclear amounts and missing proof never become automatic payments.</span>
            </div>
            <div className="settings-principle">
              <Check size={15} />
              <span>Changing an approved version triggers a fresh review.</span>
            </div>
            <div className="receipt-dashed" />
            <div className="policy-version">
              <span>Current policy</span>
              <strong>Version {data.policy.version}</strong>
            </div>
          </section>
          <section className="settings-identity">
            <span className="eyebrow">YOUR WORKSPACE ACCESS</span>
            <div>
              <UserRound size={17} />
              <strong>{data.member.name}</strong>
            </div>
            <p>
              {data.member.role === 'reviewer'
                ? 'Finance reviewer · You can review team claims and maintain policy. You cannot approve your own claim.'
                : 'Team member · You can submit and view your own claims. Your finance team can review them.'}
            </p>
            <div>
              <LockKeyhole size={14} />
              <span>Roles are managed by the server.</span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function ProfileSettings({ profile }: { profile: RecipientProfile }) {
  const { data, reload, notify } = useApp();
  const [email, setEmail] = useState(profile.email);
  const [confirmed, setConfirmed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: email.trim(),
          confirmed: true,
          expectedVersion: profile.version,
        }),
      });
      setOpen(false);
      await reload();
      notify('PayPal recipient confirmed. Unsent claims will use a fresh review where required.');
    } catch (err) {
      setError(errorMessage(err));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-panel">
      <div className="section-heading">
        <span className="section-icon">
          <Wallet size={20} />
        </span>
        <div>
          <h2>Your PayPal recipient</h2>
          <p>
            Payments go to this separately confirmed profile, never to an address found on a
            receipt.
          </p>
        </div>
      </div>
      <ErrorBox message={error} />
      {profile.confirmedAt && (
        <div className="profile-confirmed">
          <CheckCircle2 size={18} />
          <span>
            Recipient confirmed <span className="inline-dot">·</span> Version {profile.version}
          </span>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <label>
          PayPal email
          <div className="input-affix email-affix">
            <span>
              <Mail size={17} />
            </span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setConfirmed(false);
              }}
              placeholder={data?.mode === 'demo' ? 'alex@example.test' : 'Your own PayPal email'}
              maxLength={254}
            />
          </div>
        </label>
        <label className="check-label profile-check">
          <input
            required
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            I confirm that this is my own PayPal receiving account.
            <small>
              {data?.mode === 'demo'
                ? 'Use a synthetic email in this demo workspace.'
                : 'Use a PayPal Personal Sandbox account for this test environment.'}
            </small>
          </span>
        </label>
        <div className="form-footer">
          <span>
            <LockKeyhole size={13} />
            Changing this profile can invalidate unsent approvals.
          </span>
          <button
            type="submit"
            className="button primary"
            disabled={busy || !confirmed || !email.trim()}
          >
            Confirm recipient
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
      {open && (
        <Modal
          title="Confirm your receiving account?"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p className="modal-description">
            Check the address carefully. Approved reimbursements use this profile, not the
            merchant’s details.
          </p>
          <div className="modal-summary">
            <span>YOUR PAYPAL RECIPIENT</span>
            <strong className="recipient-email">{email.trim()}</strong>
            <small>{data?.mode === 'demo' ? 'Local simulation only' : 'PayPal Sandbox only'}</small>
          </div>
          <div className="info-box">
            <Info size={17} />
            <span>
              Pending approvals may need to be reviewed again. Claims with a payment already in
              progress keep their locked recipient.
            </span>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Go back
            </button>
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? <LoaderCircle size={16} className="spin" /> : 'Confirm account'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function toMinor(input: string, label: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.trim()))
    throw new Error(`${label} must be a positive amount in pounds and pence.`);
  const [whole, fraction = ''] = input.trim().split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is not a valid amount.`);
  return value;
}

function PolicySettings({ policy, canEdit }: { policy: Policy; canEdit: boolean }) {
  const { reload, notify } = useApp();
  const [enabled, setEnabled] = useState(policy.autoPaymentEnabled);
  const [single, setSingle] = useState((policy.singleLimitMinor / 100).toFixed(2));
  const [monthly, setMonthly] = useState((policy.monthlyLimitMinor / 100).toFixed(2));
  const [days, setDays] = useState(String(policy.maxAgeDays));
  const [categories, setCategories] = useState<Category[]>(policy.autoCategories);
  const [error, setError] = useState('');
  const [proposed, setProposed] = useState<PolicyInput | null>(null);
  const [busy, setBusy] = useState(false);
  function confirm(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (!/^\d+$/.test(days) || !Number.isSafeInteger(Number(days)))
        throw new Error('Enter a valid number of calendar days.');
      setProposed({
        autoPaymentEnabled: enabled,
        autoCategories: categories,
        singleLimitMinor: toMinor(single, 'Single-claim limit'),
        monthlyLimitMinor: toMinor(monthly, 'Monthly limit'),
        maxAgeDays: Number(days),
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  async function save() {
    if (!proposed) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/policy', {
        method: 'PUT',
        body: JSON.stringify({ expectedVersion: policy.version, ...proposed }),
      });
      setProposed(null);
      await reload();
      notify('New policy version saved. Unsent approvals will be checked against it.');
    } catch (err) {
      setError(errorMessage(err));
      setProposed(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-panel policy-settings">
      <div className="section-heading">
        <span className="section-icon">
          <Settings2 size={20} />
        </span>
        <div>
          <h2>Team reimbursement policy</h2>
          <p>
            {canEdit
              ? 'Set the conditions for clear, small expenses. All exceptions still go to finance.'
              : 'Your finance team maintains these rules. The same policy is used for every claim.'}
          </p>
        </div>
        <span className="version-tag">v{policy.version}</span>
      </div>
      <ErrorBox message={error} />
      {canEdit ? (
        <form onSubmit={confirm}>
          <div className="automation-setting">
            <div className="automation-title">
              <ShieldCheck size={21} />
              <div>
                <strong>Automatic payments</strong>
                <p>
                  {enabled
                    ? 'Fully eligible small claims can be approved and sent automatically.'
                    : 'Finance approves claims before a payment can be sent.'}
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={enabled}
              aria-label="Automatic payments"
              type="button"
              className={`switch ${enabled ? 'on' : ''}`}
              onClick={() => setEnabled((value) => !value)}
            >
              <span />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Single-claim auto limit
              <div className="input-affix">
                <span>£</span>
                <input
                  inputMode="decimal"
                  value={single}
                  onChange={(event) => setSingle(event.target.value)}
                  required
                />
              </div>
            </label>
            <label>
              Monthly auto limit per person
              <div className="input-affix">
                <span>£</span>
                <input
                  inputMode="decimal"
                  value={monthly}
                  onChange={(event) => setMonthly(event.target.value)}
                  required
                />
              </div>
            </label>
            <label>
              Submission window
              <div className="input-suffix">
                <input
                  inputMode="numeric"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  required
                />
                <span>calendar days</span>
              </div>
            </label>
            <label>
              Settlement currency
              <input value="GBP · British pound" readOnly />
            </label>
          </div>
          <fieldset className="category-checks">
            <legend>Categories eligible for automatic payment</legend>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <label className="check-label" key={value}>
                <input
                  type="checkbox"
                  checked={categories.includes(value as Category)}
                  onChange={(event) =>
                    setCategories((previous) =>
                      event.target.checked
                        ? [...previous, value as Category]
                        : previous.filter((category) => category !== value),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div className="info-box">
            <Info size={17} />
            <span>
              Monthly limits include approved unpaid claims and paid claims in the original
              submission month. Unclear evidence, duplicates and policy exceptions require a
              person’s review.
            </span>
          </div>
          <div className="form-footer">
            <span>
              <ClipboardCheck size={14} />A saved change creates a new policy version.
            </span>
            <button className="button primary" type="submit" disabled={busy}>
              Review policy changes
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="read-only-policy">
            <div>
              <span>
                <CircleDollarSign size={18} />
                Single-claim auto limit
              </span>
              <strong>{money(policy.singleLimitMinor)}</strong>
            </div>
            <div>
              <span>
                <Wallet size={18} />
                Monthly auto limit
              </span>
              <strong>{money(policy.monthlyLimitMinor)}</strong>
            </div>
            <div>
              <span>
                <FileWindowIcon />
                Submission window
              </span>
              <strong>{policy.maxAgeDays} calendar days</strong>
            </div>
            <div>
              <span>
                <ShieldCheck size={18} />
                Automatic payments
              </span>
              <strong className={policy.autoPaymentEnabled ? 'teal-text' : ''}>
                {policy.autoPaymentEnabled ? 'Enabled' : 'Disabled'}
              </strong>
            </div>
          </div>
          <div className="read-only-categories">
            <span>Eligible categories</span>
            <div>
              {policy.autoCategories.map((category) => (
                <span key={category}>{categoryLabels[category]}</span>
              ))}
            </div>
          </div>
        </>
      )}
      {proposed && (
        <Modal
          title="Save this policy version?"
          onClose={() => {
            if (!busy) setProposed(null);
          }}
        >
          <p className="modal-description">
            Unsent payments will be checked against the new policy. Disabling automation pauses
            unsent automatic approvals; existing manual approvals still require valid details.
          </p>
          <div className="policy-change-summary">
            <div>
              <span>Automatic payments</span>
              <strong>{proposed.autoPaymentEnabled ? 'Enabled' : 'Disabled'}</strong>
            </div>
            <div>
              <span>Single-claim limit</span>
              <strong>{money(proposed.singleLimitMinor)}</strong>
            </div>
            <div>
              <span>Monthly limit per person</span>
              <strong>{money(proposed.monthlyLimitMinor)}</strong>
            </div>
            <div>
              <span>Submission window</span>
              <strong>{proposed.maxAgeDays} days</strong>
            </div>
          </div>
          {proposed.autoPaymentEnabled && (
            <div className="info-box">
              <ShieldCheck size={18} />
              <span>
                Only claims that pass every rule and have a confirmed recipient may be approved and
                paid automatically.
              </span>
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setProposed(null)}
            >
              Keep editing
            </button>
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? <LoaderCircle size={16} className="spin" /> : 'Save new policy'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function FileWindowIcon() {
  return <ClipboardCheck size={18} />;
}
