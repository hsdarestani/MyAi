export interface PaymentProvider {
  createPayment(userId: string, amount: number): Promise<{ paymentUrl: string; paymentId: string }>;
  verifyPayment(paymentId: string): Promise<{ success: boolean; amount: number; authority?: string; reference?: string }>;
}
export class MockPaymentProvider implements PaymentProvider {
  async createPayment(userId: string, amount: number): Promise<{ paymentUrl: string; paymentId: string }> { return { paymentUrl: `/mock-pay/${userId}/${amount}`, paymentId: `mock-${Date.now()}` }; }
  async verifyPayment(paymentId: string): Promise<{ success: boolean; amount: number; reference?: string }> { return { success: true, amount: 0, reference: paymentId }; }
}
export class ManualAdminApprovalProvider implements PaymentProvider {
  async createPayment(userId: string, amount: number): Promise<{ paymentUrl: string; paymentId: string }> { return { paymentUrl: `/payments/manual?user=${userId}&amount=${amount}`, paymentId: `manual-${Date.now()}` }; }
  async verifyPayment(paymentId: string): Promise<{ success: boolean; amount: number; authority?: string }> { return { success: false, amount: 0, authority: paymentId }; }
}
export class ZarinpalPaymentProvider implements PaymentProvider {
  async createPayment(userId: string, amount: number): Promise<{ paymentUrl: string; paymentId: string }> { return { paymentUrl: '', paymentId: `zarinpal-unconfigured-${userId}-${amount}` }; }
  async verifyPayment(paymentId: string): Promise<{ success: boolean; amount: number; authority?: string }> { return { success: false, amount: 0, authority: paymentId }; }
}
