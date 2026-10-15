import { PayHereCheckoutParams, PayHerePaymentResult } from './payhere-types';

export interface PaymentGatewayService {
  startPayment(params: PayHereCheckoutParams): Promise<PayHerePaymentResult>;
}

export { payHereGateway } from './payhere-gateway.web';
