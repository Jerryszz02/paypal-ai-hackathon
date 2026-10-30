import type { Metadata } from 'next';
import { AppProvider } from '@/components/app-provider';
import { AppShell } from '@/components/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carry — Team reimbursements',
  description: 'Keep receipts, checks, approvals and reimbursement payments together.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
