'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hasFeature } from '@hh/billing';
import type { PlanFeature, AccessStatus } from '@hh/billing';

const nav: { href: string; label: string; icon: string; feature?: PlanFeature }[] = [
  { href: '/home',      label: 'Início',          icon: '🏠' },
  { href: '/schedule',  label: 'Agenda',          icon: '📅' },
  { href: '/patients',  label: 'Pacientes',       icon: '👥' },
  { href: '/notes',     label: 'Evoluções',       icon: '📝' },
  { href: '/billing',   label: 'Financeiro',      icon: '💳', feature: 'financeiro' },
  { href: '/settings',  label: 'Configurações',   icon: '⚙️' },
];

interface Props {
  subscriptionPlan?: string;
  accessStatus?: string;
}

export function Sidebar({ subscriptionPlan = 'starter', accessStatus = 'trial' }: Props) {
  const pathname = usePathname();
  const status = accessStatus as AccessStatus;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 py-6 px-4">
        <div className="mb-8 px-2 flex items-center justify-between">
          <span className="text-lg font-bold text-sky-600">Home Health</span>
          {accessStatus === 'active' && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 capitalize">
              {subscriptionPlan}
            </span>
          )}
          {accessStatus === 'trial' && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
              trial
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const allowed = hasFeature(item.feature ?? 'agenda', subscriptionPlan, status) || !item.feature;
            if (!allowed) {
              return (
                <Link
                  key={item.href}
                  href="/subscribe"
                  title="Faça upgrade para acessar"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-50 group"
                >
                  <span className="opacity-40">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-sky-400 hidden group-hover:inline">Pro</span>
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-50">
        {nav.slice(0, 5).map((item) => {
          const active = pathname.startsWith(item.href);
          const allowed = hasFeature(item.feature ?? 'agenda', subscriptionPlan, status) || !item.feature;
          return (
            <Link
              key={item.href}
              href={allowed ? item.href : '/subscribe'}
              className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                active ? 'text-sky-600' : allowed ? 'text-slate-500' : 'text-slate-300'
              }`}
            >
              <span className={`text-xl ${!allowed ? 'opacity-40' : ''}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
