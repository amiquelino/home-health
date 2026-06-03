import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { getAccessStatus, trialDaysRemaining } from '@hh/billing';

async function logoutAction() {
  'use server';
  await signOut({ redirectTo: '/login' });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  const userName = session.user?.name ?? session.user?.email ?? '';

  const accessStatus = getAccessStatus({
    subscriptionStatus: session.user.subscriptionStatus ?? 'trial',
    createdAt: new Date(session.user.createdAt || Date.now()),
  });

  if (accessStatus === 'expired' || accessStatus === 'blocked') {
    redirect('/subscribe');
  }

  const daysLeft = accessStatus === 'trial'
    ? trialDaysRemaining(new Date(session.user.createdAt || Date.now()))
    : 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        subscriptionPlan={session.user.subscriptionPlan ?? 'starter'}
        accessStatus={accessStatus}
        role={session.user.role ?? 'practitioner'}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Trial banner */}
        {accessStatus === 'trial' && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex items-center justify-between">
            <span className="text-xs text-yellow-800">
              {daysLeft > 0
                ? `Trial: ${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'}`
                : 'Seu trial termina hoje'}
            </span>
            <Link href="/subscribe" className="text-xs font-semibold text-yellow-900 hover:underline">
              Assinar agora →
            </Link>
          </div>
        )}

        {/* Top bar */}
        <header className="hidden md:flex items-center justify-end gap-3 px-8 py-3 bg-white border-b border-slate-200">
          <span className="text-sm text-slate-600">{userName}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Sair
            </button>
          </form>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
