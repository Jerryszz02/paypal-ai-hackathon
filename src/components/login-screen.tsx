'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { api, errorMessage, useApp } from './app-provider';
import { CarryLogo } from './app-shell';
import { ErrorBox } from './ui';

interface AuthConfig {
  mode: 'demo' | 'sandbox';
  demoUsers: { id: string; name: string; role: string }[];
  configured: boolean;
}
export function LoginScreen() {
  const router = useRouter();
  const { data, reload } = useApp();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function loadConfig() {
    try {
      setConfig(await api<AuthConfig>('/api/auth/config'));
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    let active = true;
    api<AuthConfig>('/api/auth/config')
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch((err: unknown) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);
  async function login(event?: React.FormEvent<HTMLFormElement>, demoUserId?: string) {
    event?.preventDefault();
    const form = event ? new FormData(event.currentTarget) : null;
    setBusy(demoUserId || 'login');
    setError('');
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(
          demoUserId
            ? { demoUserId }
            : { email: form?.get('email'), password: form?.get('password') },
        ),
      });
      await reload();
      router.replace('/claims');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="login-layout">
      <div className="login-story">
        <Link className="brand-link" href="/claims">
          <CarryLogo />
        </Link>
        <div className="login-story-copy">
          <span className="eyebrow">TEAM REIMBURSEMENTS, WITH CLARITY</span>
          <h1>
            Less chasing.
            <br />
            More clarity.
          </h1>
          <p>
            From the receipt in your pocket to the payment in your account. Keep every step
            together.
          </p>
        </div>
        <div className="login-illustration" aria-hidden="true">
          <div className="illustration-receipt">
            <div className="illustration-stamp">
              <ReceiptText size={22} />
            </div>
            <span>THE PAPER TRAIL</span>
            <h3>
              One expense.
              <br />A complete story.
            </h3>
            <div className="illustration-line" />
            <div className="illustration-row">
              <span>Original receipt</span>
              <Check size={16} />
            </div>
            <div className="illustration-row">
              <span>Clear purpose</span>
              <Check size={16} />
            </div>
            <div className="illustration-row">
              <span>Confirmed details</span>
              <Check size={16} />
            </div>
            <div className="illustration-dashes" />
            <div className="illustration-bottom">
              <span>READY FOR REVIEW</span>
              <ShieldCheck size={21} />
            </div>
          </div>
          <div className="illustration-check">
            <FileCheck2 size={22} />
            <span>Evidence, attached.</span>
          </div>
          <div className="illustration-payment">
            <Wallet size={21} />
            <span>Every step, recorded.</span>
          </div>
        </div>
        <div className="login-story-footer">
          <ShieldCheck size={17} />
          <span>Private receipts. Visible progress.</span>
        </div>
      </div>
      <main className="login-main">
        <div className="login-form-container">
          <span className="login-welcome">WELCOME TO CARRY</span>
          <h2>{config?.mode === 'demo' ? 'Take a look around.' : 'Welcome back.'}</h2>
          <p className="login-description">
            {config?.mode === 'demo'
              ? 'Choose a role to explore the reimbursement workflow in a local demo workspace.'
              : 'Sign in to your team’s reimbursement workspace.'}
          </p>
          <ErrorBox message={error} />
          {!config ? (
            <button
              className="button secondary"
              onClick={() => void loadConfig()}
              disabled={!error}
            >
              {error ? (
                'Try loading again'
              ) : (
                <>
                  <LoaderCircle size={17} className="spin" />
                  Loading sign-in…
                </>
              )}
            </button>
          ) : config.mode === 'demo' ? (
            <>
              <div className="demo-accounts">
                {config.demoUsers.map((member) => (
                  <button
                    type="button"
                    className="demo-account"
                    key={member.id}
                    disabled={!!busy}
                    onClick={() => void login(undefined, member.id)}
                  >
                    <span
                      className={`demo-account-icon ${member.role === 'reviewer' ? 'reviewer' : ''}`}
                    >
                      {member.role === 'reviewer' ? (
                        <ClipboardCheck size={23} />
                      ) : (
                        <UserRound size={23} />
                      )}
                    </span>
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.role === 'reviewer'
                          ? 'Finance reviewer · Approve & manage policy'
                          : 'Team member · Submit & track claims'}
                      </small>
                    </span>
                    {busy === member.id ? (
                      <LoaderCircle size={19} className="spin" />
                    ) : (
                      <ArrowRight size={19} />
                    )}
                  </button>
                ))}
              </div>
              <div className="demo-explanation">
                <ShieldCheck size={19} />
                <p>
                  <strong>A safe place to try the flow.</strong>All receipts are synthetic. AI
                  extraction and payments are simulated. No money moves, and no external AI service
                  is called.
                </p>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={(event) => void login(event)} className="login-form">
                <label>
                  Work email
                  <input
                    required
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@your-team.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    required
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                  />
                </label>
                <button
                  type="submit"
                  className="button primary"
                  disabled={!!busy || !config.configured}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <>
                      Sign in <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              {!config.configured && (
                <p className="muted-note">
                  This workspace needs its server-side service configuration before sign-in can be
                  used.
                </p>
              )}
              <p className="muted-note">
                Accounts are provisioned by your workspace administrator. There is no public
                registration.
              </p>
            </>
          )}
          {data && (
            <Link href="/claims" className="continue-link">
              Continue as {data.member.name}
              <ArrowRight size={16} />
            </Link>
          )}
          <div className="login-security">
            <LockKeyhole size={15} />
            <span>
              {config?.mode === 'demo'
                ? 'Local access only · No real credentials needed'
                : 'Secure team access · PayPal Sandbox only'}
            </span>
          </div>
        </div>
        <footer className="login-footer">Carry your expenses forward.</footer>
      </main>
    </div>
  );
}
