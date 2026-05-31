import type { PaymentProvider, PixChargeResult } from '../interface';

export class MercadoPagoProvider implements PaymentProvider {
  constructor(private readonly accessToken: string) {}

  async createPixCharge(params: {
    customerName: string;
    customerCpf: string;
    customerEmail: string;
    amount: number;
    dueDate: string;
    description: string;
  }): Promise<PixChargeResult> {
    const [firstName, ...rest] = params.customerName.trim().split(' ');
    const expirationDate = new Date(`${params.dueDate}T23:59:59.000-03:00`).toISOString();

    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${params.customerCpf}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: params.amount,
        description: params.description,
        payment_method_id: 'pix',
        date_of_expiration: expirationDate,
        payer: {
          email: params.customerEmail,
          first_name: firstName,
          last_name: rest.join(' ') || firstName,
          identification: {
            type: 'CPF',
            number: params.customerCpf.replace(/\D/g, ''),
          },
        },
      }),
    });

    if (!res.ok) throw new Error(`Mercado Pago error ${res.status}: ${await res.text()}`);
    const data = await res.json();

    return {
      chargeId: String(data.id),
      pixCopiaECola: data.point_of_interaction?.transaction_data?.qr_code ?? null,
      invoiceUrl: data.point_of_interaction?.transaction_data?.ticket_url ?? null,
    };
  }
}
