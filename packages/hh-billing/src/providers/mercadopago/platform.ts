import type { PlatformProvider, PlatformSubscriptionResult } from '../platform-interface';

const BASE = 'https://api.mercadopago.com';

export class MercadoPagoPlatformProvider implements PlatformProvider {
  constructor(private readonly accessToken: string) {}

  async createSubscription(params: {
    customerEmail: string;
    customerName: string;
    amount: number;
    description: string;
    externalReference: string;
  }): Promise<PlatformSubscriptionResult> {
    const res = await fetch(`${BASE}/preapproval`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${params.externalReference}-${Date.now()}`,
      },
      body: JSON.stringify({
        reason: params.description,
        external_reference: params.externalReference,
        payer_email: params.customerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: params.amount,
          currency_id: 'BRL',
        },
        back_url: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      }),
    });

    if (!res.ok) throw new Error(`Mercado Pago preapproval error ${res.status}: ${await res.text()}`);
    const data = await res.json();

    return {
      subscriptionId: data.id,
      paymentUrl: data.init_point,
    };
  }
}
