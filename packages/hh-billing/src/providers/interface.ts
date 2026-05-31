export type ProviderType = 'asaas' | 'mercadopago';

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
}

export interface PixChargeResult {
  chargeId: string;
  pixCopiaECola: string | null;
  invoiceUrl: string | null;
}

export interface PaymentProvider {
  createPixCharge(params: {
    customerName: string;
    customerCpf: string;
    customerEmail: string;
    amount: number;
    dueDate: string;
    description: string;
  }): Promise<PixChargeResult>;
}
