import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { readSession, SESSION_COOKIE } from '@/lib/session-cookie';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(SESSION_COOKIE)?.value);

  // proxy.ts has already redirected, unless the token expired since then.
  if (!session) redirect('/sign-in');

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar email={session.email} />
      <main className="flex min-w-0 flex-1 flex-col gap-7 px-4 pt-7 pb-14 md:px-10">
        {children}
      </main>
    </div>
  );
}
