import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-12">
      {children}
    </div>
  );
}
