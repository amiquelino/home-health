import type { PlatformProvider, PlatformSubscriptionResult } from '../platform-interface';
import { makeAsaasClient } from './provider';

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
    });

    return {
      subscriptionId: subscription.id,
      paymentUrl: `https://${process.env.ASAAS_SANDBOX === 'true' ? 'sandbox' : 'www'}.asaas.com/c/${subscription.id}`,
    };
  }
}
