'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Bootstrap } from '@/lib/types';

export interface AppBootstrap extends Bootstrap {
  mode: 'demo' | 'sandbox';
  services?: { ai?: string; payments?: string; database?: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      result.error ?? 'This action could not be completed. Please try again.',
      response.status,
      result.code ?? 'REQUEST_FAILED',
    );
  return result as T;
}

interface AppContextValue {
  data: AppBootstrap | null;
  loading: boolean;
  error: string;
  unauthorized: boolean;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    try {
      const next = await api<AppBootstrap>('/api/bootstrap');
      setData(next);
      setError('');
      setUnauthorized(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setData(null);
        setUnauthorized(true);
        setError('');
      } else setError(err instanceof Error ? err.message : 'Could not load your workspace.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<AppBootstrap>('/api/bootstrap')
      .then((next) => {
        if (active) {
          setData(next);
          setError('');
          setUnauthorized(false);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) setUnauthorized(true);
        else setError(err instanceof Error ? err.message : 'Could not load your workspace.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5500);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  return (
    <AppContext.Provider value={{ data, loading, error, unauthorized, reload, notify: setNotice }}>
      {children}
      <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">
        {notice}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider is missing.');
  return context;
}

export function money(value: number | null, currency = 'GBP') {
  if (value === null) return 'Not confirmed';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value / 100);
  } catch {
    return `${currency} ${(value / 100).toFixed(2)}`;
  }
}

export function dateLabel(value: string | null, includeTime = false) {
  if (!value) return 'Not submitted';
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(includeTime ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(date);
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'This action could not be completed. Please try again.';
}

export const categoryLabels: Record<string, string> = {
  transport: 'Transport',
  office_supplies: 'Office supplies',
  meals: 'Meals',
  accommodation: 'Accommodation',
  other: 'Other',
};

export function sourceFieldLabel(field: string) {
  return (
    (
      {
        merchant: 'Merchant',
        receiptNumber: 'Receipt number',
        date: 'Expense date',
        currency: 'Currency',
        totalMinor: 'Receipt total',
        items: 'Line items',
        paidEvidence: 'Proof of payment',
        purposeMatches: 'Expense purpose',
        category: 'Expense category',
      } as Record<string, string>
    )[field] ?? 'Receipt evidence'
  );
}
