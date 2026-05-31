import type { PaymentProvider, ProviderConfig } from './interface';
import { AsaasProvider } from './asaas/provider';
import { MercadoPagoProvider } from './mercadopago/provider';

export function getProvider(config: ProviderConfig): PaymentProvider {
  switch (config.type) {
    case 'asaas':
      return new AsaasProvider(config.apiKey);
    case 'mercadopago':
      return new MercadoPagoProvider(config.apiKey);
    default:
      throw new Error(`Unknown payment provider: ${(config as ProviderConfig).type}`);
  }
}
