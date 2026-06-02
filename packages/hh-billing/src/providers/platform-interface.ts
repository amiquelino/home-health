export interface PlatformSubscriptionResult {
  subscriptionId: string;
  paymentUrl: string;
}

export interface PlatformProvider {
  createSubscription(params: {
    customerEmail: string;
    customerName: string;
    amount: number;
    description: string;
    externalReference: string;
  }): Promise<PlatformSubscriptionResult>;
}
