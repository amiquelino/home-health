import type { PlatformProvider } from './platform-interface';
import { AsaasPlatformProvider } from './asaas/platform';
import { MercadoPagoPlatformProvider } from './mercadopago/platform';

export function getPlatformProvider(): PlatformProvider {
  if (process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN) {
    return new MercadoPagoPlatformProvider(process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN);
  }
  if (process.env.ASAAS_PLATFORM_API_KEY) {
    return new AsaasPlatformProvider(process.env.ASAAS_PLATFORM_API_KEY);
  }
  throw new Error('No platform payment provider configured. Set MERCADOPAGO_PLATFORM_ACCESS_TOKEN or ASAAS_PLATFORM_API_KEY.');
}
