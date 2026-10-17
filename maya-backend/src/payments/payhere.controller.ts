import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  Logger,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { PayHereService } from './payhere.service.js';
import { SubscriptionReconciliationService } from './subscription-reconciliation.service.js';
import { AuthService } from '../auth/auth.service.js';
import {
  GenerateCheckoutParamsDto,
  CancelSubscriptionDto,
  RetrySubscriptionDto,
  ChargeSavedCardDto,
} from './dto/payhere.dto.js';
import type { PayHereWebhookPayload } from './payhere.types.js';

@Controller('v1')
export class PayHereController {
  private readonly logger = new Logger(PayHereController.name);

  constructor(
    private readonly payHereService: PayHereService,
    private readonly reconciliationService: SubscriptionReconciliationService,
    private readonly authService: AuthService
  ) {}

  /**
   * Endpoint for client to request server-signed PayHere checkout parameters.
   */
  @Post('payments/payhere/checkout-params')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getCheckoutParams(
    @Body() dto: GenerateCheckoutParamsDto,
    @Headers('authorization') authHeader?: string
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    const params = await this.payHereService.generateCheckoutParams(userId, dto);
    return { success: true, params };
  }

  /**
   * Automated Charging: 1-click automatic deduction using pre-approved saved card.
   * Charges card programmatically on demand without opening PayHere checkout UI.
   */
  @Post('payments/payhere/charge-saved-card')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async chargeSavedCard(
    @Body() dto: ChargeSavedCardDto,
    @Headers('authorization') authHeader?: string
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    const result = await this.payHereService.chargeSavedCard(userId, dto);
    return result;
  }

  /**
   * Server callback from PayHere Payment Gateway (notify_url).
   * PayHere sends POST with application/x-www-form-urlencoded body.
   */
  @Post('payments/payhere/notify')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: PayHereWebhookPayload,
    @Headers() headers: Record<string, string>,
    @Req() req: any
  ) {
    const remoteIp = headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown';
    const contentType = headers['content-type'] || 'unknown';
    const userAgent = headers['user-agent'] || 'unknown';

    this.logger.log(`[PayHereController] 📥 HTTP POST /v1/payments/payhere/notify received`);
    this.logger.log(`[PayHereController] Source: IP=${remoteIp}, Content-Type="${contentType}", User-Agent="${userAgent}"`);
    this.logger.log(`[PayHereController] Payload keys received: [${Object.keys(payload || {}).join(', ')}]`);

    await this.payHereService.handlePaymentNotification(payload);
    return 'OK';
  }

  /**
   * User Self-Service: Get currently active subscription details.
   */
  @Get('subscriptions/my')
  async getMySubscription(@Headers('authorization') authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    const subscription = await this.payHereService.getUserActiveSubscription(userId);
    return { success: true, subscription };
  }

  /**
   * User Self-Service: Cancel active recurring subscription.
   */
  @Post('subscriptions/cancel')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async cancelMySubscription(
    @Body() dto: CancelSubscriptionDto,
    @Headers('authorization') authHeader?: string
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    let subId = dto.subscriptionId;

    if (!subId) {
      const activeSub = await this.payHereService.getUserActiveSubscription(userId);
      if (!activeSub || !activeSub.payhere_subscription_id) {
        throw new BadRequestException('No active subscription found to cancel.');
      }
      subId = activeSub.payhere_subscription_id;
    }

    if (!subId) {
      throw new BadRequestException('Subscription ID could not be identified.');
    }

    return this.payHereService.cancelSubscription(subId, userId);
  }

  /**
   * Admin: List all subscribers with overview metrics (MRR, active, churned).
   */
  @Get('admin/subscriptions')
  async getAdminSubscriptions() {
    return this.payHereService.getAdminSubscriptions();
  }

  /**
   * Admin: List orders with filters (subscription renewals, talk-time top-ups, initial subscriptions).
   */
  @Get('admin/orders')
  async getAdminOrders(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const orders = await this.payHereService.getAdminOrders(type, limit ? parseInt(limit, 10) : 100);
    return { success: true, orders };
  }

  /**
   * Admin: View payment history / installments for a subscription.
   */
  @Get('admin/subscriptions/:id/payments')
  async getSubscriptionPayments(@Param('id') subscriptionId: string) {
    const payments = await this.payHereService.getSubscriptionPayments(subscriptionId);
    return { success: true, payments };
  }

  /**
   * Admin: Retry failed subscription charge.
   */
  @Post('admin/subscriptions/:id/retry')
  async retrySubscription(@Param('id') subscriptionId: string) {
    return this.payHereService.retrySubscription(subscriptionId);
  }

  /**
   * Admin: Cancel user subscription.
   */
  @Post('admin/subscriptions/:id/cancel')
  async cancelAdminSubscription(@Param('id') subscriptionId: string) {
    return this.payHereService.cancelSubscription(subscriptionId);
  }

  /**
   * Admin / Automation: Run on-demand reconciliation of subscriptions and quotas.
   */
  @Post('admin/subscriptions/reconcile')
  async triggerReconciliation() {
    return this.reconciliationService.reconcileSubscriptions();
  }

  /**
   * Resilient Verification & Recovery:
   * Client calls this endpoint upon return from PayHere checkout to ensure payment is activated
   * immediately, even if server was restarted or webhook was delayed.
   */
  @Post('payments/payhere/verify-order/:orderId')
  async verifyOrder(
    @Param('orderId') orderId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    if (authHeader) {
      this.authService.validateAuthToken(authHeader);
    }
    return this.payHereService.reconcilePendingOrder(orderId);
  }

  /**
   * Admin: Verify and sync a specific order with PayHere Gateway.
   */
  @Post('admin/orders/:id/verify')
  async adminVerifyOrder(@Param('id') orderId: string) {
    return this.payHereService.reconcilePendingOrder(orderId);
  }
}
