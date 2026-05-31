import type { PaymentProvider, PixChargeResult } from '../interface';

function makeClient(apiKey: string) {
  const BASE_URL = process.env.ASAAS_SANDBOX === 'true'
    ? 'https://api-sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/api/v3';

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'access_token': apiKey, 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) throw new Error(`Asaas error ${res.status}: ${await res.text()}`);
    return res.json() as T;
  }

  return {
    createCustomer: (data: { name: string; cpfCnpj: string; email: string }) =>
      request<{ id: string }>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    createCharge: (data: { customer: string; value: number; dueDate: string; description: string }) =>
      request<{ id: string; invoiceUrl: string }>('/payments', {
        method: 'POST',
        body: JSON.stringify({ ...data, billingType: 'PIX' }),
      }),
    getPixQrCode: (chargeId: string) =>
      request<{ payload: string }>(`/payments/${chargeId}/pixQrCode`),
  };
}

export class AsaasProvider implements PaymentProvider {
  private client: ReturnType<typeof makeClient>;

  constructor(apiKey: string) {
    this.client = makeClient(apiKey);
  }

  async createPixCharge(params: {
    customerName: string;
    customerCpf: string;
    customerEmail: string;
    amount: number;
    dueDate: string;
    description: string;
  }): Promise<PixChargeResult> {
    const customer = await this.client.createCustomer({
      name: params.customerName,
      cpfCnpj: params.customerCpf.replace(/\D/g, ''),
      email: params.customerEmail,
    });

    const charge = await this.client.createCharge({
      customer: customer.id,
      value: params.amount,
      dueDate: params.dueDate,
      description: params.description,
    });

    const qr = await this.client.getPixQrCode(charge.id).catch(() => null);

    return {
      chargeId: charge.id,
      pixCopiaECola: qr?.payload ?? null,
      invoiceUrl: charge.invoiceUrl,
    };
  }
}
