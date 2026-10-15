import { Module } from '@nestjs/common';
import { PayHereController } from './payhere.controller.js';
import { PayHereService } from './payhere.service.js';
import { SubscriptionReconciliationService } from './subscription-reconciliation.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [PayHereController],
  providers: [PayHereService, SubscriptionReconciliationService],
  exports: [PayHereService, SubscriptionReconciliationService],
})
export class PayHereModule {}
