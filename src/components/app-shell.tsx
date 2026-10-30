'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ArrowUpRight,
  CircleHelp,
  ClipboardCheck,
  FileText,
  LogOut,
  ReceiptText,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { api, useApp } from './app-provider';
import { ErrorBox, Loading } from './ui';

export function CarryLogo() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <ReceiptText size={22} strokeWidth={1.7} />
      </span>
      <span>
        carry<span className="brand-stop">.</span>
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, loading, error, unauthorized, reload, notify } = useApp();
  const login = pathname === '/login';
  useEffect(() => {
    if (!login && unauthorized) router.replace('/login');
  }, [login, unauthorized, router]);
  if (login) return <>{children}</>;
  if (loading || unauthorized) return <Loading />;
  if (!data)
    return (
      <div className="workspace-error">
        <CarryLogo />
        <ErrorBox message={error || 'Your workspace could not be loaded.'} />
        <button className="button primary" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    );
  const reviewer = data.member.role === 'reviewer';
  const reviewCount = data.claims.filter(
    (claim) =>
      ['needs_review', 'needs_info'].includes(claim.reviewStatus) ||
      ['unknown', 'failed', 'returned', 'unclaimed'].includes(claim.paymentStatus),
  ).length;
  const section = pathname.startsWith('/settings')
    ? 'Settings'
    : pathname.startsWith('/review')
      ? 'Review workspace'
      : 'Claims';
  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      await reload();
      router.replace('/login');
    } catch {
      notify('Could not sign out. Please try again.');
    }
  }
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/claims" className="brand-link" aria-label="Carry home">
          <CarryLogo />
        </Link>
        <div className="organization-switch">
          <span className="organization-avatar">
            N<span>↗</span>
          </span>
          <div>
            <strong>{data.organization.name}</strong>
            <span>Team workspace</span>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link
            aria-label={reviewer ? 'All claims' : 'My claims'}
            aria-current={pathname.startsWith('/claims') ? 'page' : undefined}
            className={`nav-link ${pathname.startsWith('/claims') ? 'active' : ''}`}
            href="/claims"
          >
            <FileText size={19} />
            <span>{reviewer ? 'All claims' : 'My claims'}</span>
          </Link>
          {reviewer && (
            <Link
              aria-label="Review queue"
              aria-current={pathname.startsWith('/review') ? 'page' : undefined}
              className={`nav-link ${pathname.startsWith('/review') ? 'active' : ''}`}
              href="/review"
            >
              <ClipboardCheck size={19} />
              <span>Review queue</span>
              {reviewCount > 0 && <span className="nav-count">{reviewCount}</span>}
            </Link>
          )}
          <Link
            aria-label="Settings"
            aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
            className={`nav-link ${pathname.startsWith('/settings') ? 'active' : ''}`}
            href="/settings"
          >
            <Settings2 size={19} />
            <span>Settings</span>
          </Link>
        </nav>
        <div className="sidebar-guide">
          <span className="guide-symbol">
            <ShieldCheck size={20} />
          </span>
          <h3>
            Clear checks.
            <br />
            Confident decisions.
          </h3>
          <p>Receipts, approvals and payments, with a record at every step.</p>
          <Link href="/settings">
            View your policy <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <span className="sidebar-help">
            <CircleHelp size={17} />
            One expense per claim
          </span>
          <div className="user-menu">
            <span className="user-avatar">
              {data.member.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <strong>{data.member.name}</strong>
              <span>{reviewer ? 'Finance reviewer' : 'Team member'}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void logout()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-layout">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{section}</strong>
          </div>
          <div className="environment-label">
            <span />
            {data.mode === 'demo' ? 'Local demo' : 'PayPal Sandbox'}
          </div>
        </header>
        <div className={`environment-banner ${data.mode === 'demo' ? '' : 'sandbox-banner'}`}>
          <ShieldCheck size={15} />
          <span>
            {data.mode === 'demo'
              ? 'Demo workspace · Synthetic receipts, simulated AI and payments. No money moves.'
              : 'Sandbox workspace · Receipts may be sent to the configured AI service. Test payments only.'}
          </span>
        </div>
        <main id="main-content" className="page-content">
          {error && <ErrorBox message={error} />}
          {children}
        </main>
        <footer className="app-footer">
          <span>Every claim has a paper trail.</span>
          <span>
            Powered by clear rules <span className="footer-dot">·</span> Payments via{' '}
            <strong>PayPal</strong>
          </span>
        </footer>
      </div>
    </div>
  );
}
