import { auth } from '@/auth';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isOwner = session?.user?.role === 'owner';

  const tabs = [
    { href: '/settings/profile', label: 'Perfil' },
    { href: '/settings',         label: 'Pagamento' },
    ...(isOwner ? [{ href: '/settings/team', label: 'Equipe' }] : []),
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-5">Configurações</h1>
      <SettingsTabs tabs={tabs} />
      {children}
    </div>
  );
}
