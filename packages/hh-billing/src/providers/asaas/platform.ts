import type { PlatformProvider, PlatformSubscriptionResult } from '../platform-interface';
import { makeAsaasClient } from './provider';

// Maps Asaas subscription status → internal SubscriptionStatus
export function mapAsaasSubscriptionStatus(asaasStatus: string): string {
  switch (asaasStatus.toUpperCase()) {
    case 'ACTIVE':    return 'active';
    case 'OVERDUE':
    case 'INACTIVE':  return 'past_due';
    case 'CANCELLED': return 'cancelled';
    default:          return 'trial';
  }
}

export class AsaasPlatformProvider implements PlatformProvider {
  private client: ReturnType<typeof makeAsaasClient>;

  constructor(apiKey: string) {
    this.client = makeAsaasClient(apiKey);
  }

  async createSubscription(params: {
    customerEmail: string;
    customerName: string;
    amount: number;
    description: string;
    externalReference: string;
  }): Promise<PlatformSubscriptionResult> {
    const customer = await this.client.createCustomer({
      name: params.customerName,
      cpfCnpj: '00000000000',
      email: params.customerEmail,
    });

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);

    const subscription = await this.client.createSubscription({
      customer: customer.id,
      value: params.amount,
      nextDueDate: nextDueDate.toISOString().slice(0, 10),
      description: params.description,
      externalReference: params.externalReference,
    });

    return {
      subscriptionId: subscription.id,
      paymentUrl: `https://${process.env.ASAAS_SANDBOX === 'true' ? 'sandbox' : 'www'}.asaas.com/c/${subscription.id}`,
    };
  }

  async fetchSubscription(subscriptionId: string): Promise<{ id: string; status: string; externalReference: string }> {
    const sub = await this.client.fetchSubscription(subscriptionId);
    return {
      id: sub.id,
      status: mapAsaasSubscriptionStatus(sub.status),
      externalReference: sub.externalReference ?? '',
    };
  }
}
