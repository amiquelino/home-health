import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasFeature, getAccessStatus } from '@hh/billing';
import { BillingClient } from './BillingClient';

export default async function BillingPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const accessStatus = getAccessStatus({
    subscriptionStatus: session.user.subscriptionStatus ?? 'trial',
    createdAt: new Date(session.user.createdAt || Date.now()),
  });

  if (!hasFeature('financeiro', session.user.subscriptionPlan, accessStatus)) {
    redirect('/subscribe?feature=financeiro');
  }

  return <BillingClient isOwner={session.user.role === 'owner'} />;
}
