export interface PaymentProvider {
  createPayment(userId: string, amount: number): Promise<{ paymentUrl: string; paymentId: string }>;
  verifyPayment(paymentId: string): Promise<{ success: boolean; amount: number; authority?: string; reference?: string }>;
}
export class MockPaymentProvider implements PaymentProvider {
  async createPayment(userId: string, amount: number) { return { paymentUrl: `/mock-pay/${userId}/${amount}`, paymentId: `mock-${Date.now()}` }; }
  async verifyPayment(paymentId: string) { return { success: true, amount: 0, reference: paymentId }; }
}
export class ManualAdminApprovalProvider implements PaymentProvider {
  async createPayment(userId: string, amount: number) { return { paymentUrl: `/payments/manual?user=${userId}&amount=${amount}`, paymentId: `manual-${Date.now()}` }; }
  async verifyPayment(paymentId: string) { return { success: false, amount: 0, authority: paymentId }; }
}
export class ZarinpalPaymentProvider implements PaymentProvider {
  async createPayment() { throw new Error('Zarinpal credentials are not configured. Add a real adapter without hardcoded secrets.'); }
  async verifyPayment() { throw new Error('Zarinpal credentials are not configured.'); }
}
