import {
  Controller,
  Post,
  Put,
  Get,
  Logger,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UsePipes,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService, type UserProfileData } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AdminGuard } from './guards/admin.guard.js';
import { GetUser } from './decorators/get-user.decorator.js';
import { paginateArray, parsePageRequest, readPage } from '../common/pagination.js';

const backgroundLogger = new Logger('AuthControllerBackground');

/** Runs a non-critical write after the response is sent; failures are logged, never thrown. */
function runInBackground(label: string, work: Promise<unknown>): void {
  work.catch((err: any) => backgroundLogger.warn(`[${label}] background write failed: ${err?.message}`));
}
import {
  SendOtpDto,
  VerifyOtpDto,
  SavePreferencesDto,
  UpgradePlanDto,
  AddOnTopUpDto,
  UpdateStepDto,
  LogOnboardingEventDto,
  AdminUsersQueryDto,
  AdminUpdateUserDto,
  UpdateAppConfigDto,
  CreateTestAccountDto,
  SubmitComplaintDto,
  UpdateComplaintStatusDto,
  ClaimPromotionDto,
  ComebackPingDto,
  AdminPromotionClaimsQueryDto,
  CreatePromotionCampaignDto,
  UpdatePromotionCampaignDto,
  UpdateCampaignStatusDto,
  BroadcastSmsDto,
} from './dto/auth.dto.js';

@Controller('v1')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/otp/send')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: any) {
    const clientIp =
      req?.headers?.['x-forwarded-for'] ||
      req?.socket?.remoteAddress ||
      'unknown';
    this.authService.checkIpRateLimit(clientIp, 'otp_send', 10, 10 * 60 * 1000);
    return this.authService.sendOtp(dto);
  }

  @Post('auth/otp/verify')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    const clientIp =
      req?.headers?.['x-forwarded-for'] ||
      req?.socket?.remoteAddress ||
      'unknown';
    this.authService.checkIpRateLimit(clientIp, 'otp_verify', 15, 10 * 60 * 1000);
    return this.authService.verifyOtp(dto);
  }

  @Post('admin/login')
  async loginAdmin(@Body() body: { username?: string; password?: string }) {
    return this.authService.loginAdmin(body?.username || '', body?.password || '');
  }

  @Get('auth/me')
  @UseGuards(AuthGuard)
  async getMe(@GetUser() user: UserProfileData) {
    return {
      success: true,
      profile: {
        ...user,
        is_test_account: await this.authService.isTestAccount(user),
      },
    };
  }

  @Post('auth/logout')
  async logout(@Req() req: any) {
    const authHeader = req?.headers?.['authorization'] as string | undefined;
    return this.authService.revokeToken(authHeader);
  }

  @Post('users/onboarding-preferences')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async savePreferences(
    @Body() dto: SavePreferencesDto,
    @GetUser('id') userId: string,
  ) {
    return this.authService.savePreferences(userId, dto);
  }

  @Post('users/step')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateStep(
    @Body() dto: UpdateStepDto,
    @GetUser('id') userId: string,
  ) {
    // Fire-and-forget: the client ignores this response, so it no longer waits for the
    // profile write (previously 6-9 s under load because it queued behind other requests).
    runInBackground('updateStep', this.authService.updateStep(userId, dto));
    return { success: true, queued: true, step: dto.step };
  }

  @Post('users/event')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async logEvent(
    @Body() dto: LogOnboardingEventDto,
    @GetUser('id') userId: string,
  ) {
    // Fire-and-forget analytics write (client ignores the response)
    runInBackground('logOnboardingEvent', this.authService.logOnboardingEvent(userId, dto));
    return { success: true, queued: true };
  }

  @Post('plans/upgrade')
  @UseGuards(AdminGuard, AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async upgradePlan(
    @Body() dto: UpgradePlanDto,
    @GetUser('id') userId: string,
  ) {
    return this.authService.upgradePlan(userId, dto);
  }

  @Post('plans/top-up')
  @UseGuards(AdminGuard, AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async addOnTopUp(
    @Body() dto: AddOnTopUpDto,
    @GetUser('id') userId: string,
  ) {
    return this.authService.addOnTopUp(userId, dto);
  }

  @Get('plans')
  getPlans() {
    return this.authService.getPlansCatalog();
  }

  @Post('auth/telco/unsubscribe')
  @UseGuards(AuthGuard)
  async unsubscribeTelco(@GetUser('id') userId: string) {
    return this.authService.unsubscribeTelco(userId);
  }

  @Post('auth/telco/reactivate')
  @UseGuards(AuthGuard)
  async reactivateTelco(@GetUser('id') userId: string) {
    return this.authService.reactivateTelco(userId);
  }

  @Post('auth/telco/reactivate-verify')
  @UseGuards(AuthGuard)
  async verifyReactivateTelco(
    @GetUser('id') userId: string,
    @Body() body: { code: string },
  ) {
    if (!body?.code || !body.code.trim()) {
      throw new BadRequestException('Verification code is required.');
    }
    return this.authService.verifyReactivateTelco(userId, body.code.trim());
  }

  /**
   * Admin: Comprehensive analytics overview for dashboard
   */
  @Get('admin/analytics/overview')
  @UseGuards(AdminGuard)
  async getAdminAnalyticsOverview() {
    return this.authService.getAdminAnalyticsOverview();
  }

  /**
   * Admin: List users with analytics and usage metrics
   */
  @Get('admin/users')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getAdminUsers(@Query() query: AdminUsersQueryDto) {
    return this.authService.getAdminUsers(query);
  }

  /**
   * Admin: Lightweight list of users with a phone number, for the SMS broadcast recipient
   * picker. Declared before admin/users/:id so the path is not captured as an id.
   */
  @Get('admin/users/stats')
  @UseGuards(AdminGuard)
  async getAdminUsersStats() {
    return this.authService.getAdminUsersStats();
  }

  @Get('admin/users/sms-recipients')
  @UseGuards(AdminGuard)
  async getAdminSmsRecipients() {
    return this.authService.getAdminSmsRecipients();
  }

  /**
   * Admin: Get comprehensive personalized user profile with sessions and learning stats
   */
  @Get('admin/users/:id')
  @UseGuards(AdminGuard)
  async getAdminUserDetail(@Param('id') userId: string) {
    return this.authService.getAdminUserDetail(userId);
  }

  /**
   * Admin: Update user's minutes allowance, tier, or personalized goals
   */
  @Put('admin/users/:id')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async adminUpdateUser(
    @Param('id') userId: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.authService.adminUpdateUser(userId, dto);
  }

  /**
   * Admin: Permanently delete a user profile and all associated data
   */
  @Delete('admin/users/:id')
  @UseGuards(AdminGuard)
  async deleteUser(@Param('id') userId: string) {
    return this.authService.deleteUser(userId);
  }

  /**
   * Public: Retrieve current app configuration (SMS gateway, pricing notices, disclaimer text)
   * Note: Zero secrets / credentials exposed to public client.
   */
  @Get('app-config')
  async getAppConfig() {
    return this.authService.getPublicAppConfig();
  }

  /**
   * Admin: Retrieve full configuration including credentials
   */
  @Get('admin/app-config')
  @UseGuards(AdminGuard)
  async getAdminAppConfig() {
    return this.authService.getAppConfig();
  }

  /**
   * Admin: Update application configuration
   */
  @Put('admin/app-config')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateAppConfig(@Body() dto: UpdateAppConfigDto) {
    return this.authService.updateAppConfig(dto);
  }

  /**
   * Admin: List all test accounts
   */
  @Get('admin/test-accounts')
  @UseGuards(AdminGuard)
  async getTestAccounts(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const all = await this.authService.getTestAccounts();
    // Without ?page the plain array is returned (older clients); with it, one server page
    if (page === undefined) return all;
    const paged = paginateArray(all, readPage(page, pageSize));
    return { items: paged.items, pagination: paged.pagination };
  }

  /**
   * Admin: Create and provision a new test account
   */
  @Post('admin/test-accounts')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createTestAccount(@Body() dto: CreateTestAccountDto) {
    return this.authService.createTestAccount(dto);
  }

  /**
   * Admin: Delete/remove a test account
   */
  @Delete('admin/test-accounts/:id')
  @UseGuards(AdminGuard)
  async deleteTestAccount(@Param('id') id: string) {
    return this.authService.deleteTestAccount(id);
  }

  /**
   * Student: Submit a complaint or feedback
   */
  @Post('users/complaints')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async submitComplaint(
    @GetUser('id') userId: string,
    @Body() dto: SubmitComplaintDto,
  ) {
    return this.authService.submitComplaint(userId, dto);
  }

  /**
   * Public / Student: Get real database leaderboard ranked by XP and practice minutes consumed
   */
  @Get('users/leaderboard')
  async getPublicLeaderboard(
    @Query('userId') queryUserId?: string,
    @Query('period') period?: 'weekly' | 'monthly' | 'all_time',
    @Query('limit') queryLimit?: string,
    @Req() req?: any,
  ) {
    let userId = queryUserId;
    const authHeader = req?.headers?.['authorization'] as string | undefined;
    if (authHeader) {
      try {
        userId = this.authService.validateAuthToken(authHeader);
      } catch {}
    }
    const validPeriod =
      period === 'monthly' || period === 'all_time' ? period : 'weekly';
    const limitNum = queryLimit ? Math.max(1, Math.min(100, parseInt(queryLimit, 10) || 50)) : 50;
    return this.authService.getPublicLeaderboard(userId, validPeriod, limitNum);
  }

  /**
   * Admin: List all student complaints and feedback
   */
  @Get('admin/complaints')
  @UseGuards(AdminGuard)
  async getAdminComplaints(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    // Filtering, search, sort and paging all run in the database (default 10 per page)
    return this.authService.getAdminComplaintsPage(readPage(page, pageSize, limit), { status, search, sort });
  }

  /**
   * Admin: Update complaint status (open / resolved)
   */
  @Put('admin/complaints/:id/status')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintStatusDto,
  ) {
    return this.authService.updateComplaintStatus(id, dto.status);
  }

  /**
   * Admin: Delete a complaint
   */
  @Delete('admin/complaints/:id')
  @UseGuards(AdminGuard)
  async deleteComplaint(@Param('id') id: string) {
    return this.authService.deleteComplaint(id);
  }

  /**
   * Admin: List all student session reviews with star breakdown and separate comments
   */
  @Get('admin/session-reviews')
  @UseGuards(AdminGuard)
  async getAdminSessionReviews(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string,
    @Query('star') star?: string,
    @Query('content') content?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    // Filtering, search, sort and paging all run in the database (default 10 per page)
    return this.authService.getAdminSessionReviewsPage(readPage(page, pageSize, limit), { star, content, search, sort });
  }

  /**
   * Admin: Delete or clear a session review
   */
  @Delete('admin/session-reviews/:id')
  @UseGuards(AdminGuard)
  async deleteSessionReview(@Param('id') id: string) {
    return this.authService.deleteSessionReview(id);
  }

  /**
   * Student: Ping when returning to the app after the outage
   */
  @Post('promotions/comeback-ping')
  @UseGuards(AuthGuard)
  async recordComebackPing(
    @GetUser('id') userId: string,
    @Body() dto: ComebackPingDto,
  ) {
    // Fire-and-forget analytics write (client ignores the response)
    runInBackground('recordComebackPing', this.authService.recordComebackPing(userId, dto?.metadata));
    return { success: true, queued: true, timestamp: new Date().toISOString() };
  }

  /**
   * Student: Check if promotion is available to claim (verifies database claim record and campaign validity)
   */
  @Get('promotions/check/:promoCode')
  @UseGuards(AuthGuard)
  async checkPromotionEligibility(
    @GetUser('id') userId: string,
    @Param('promoCode') promoCode: string,
  ) {
    return this.authService.checkPromotionEligibility(userId, promoCode);
  }

  /**
   * Student: Claim comeback/apology promotion
   */
  @Post('promotions/claim')
  @UseGuards(AuthGuard)
  async claimPromotion(
    @GetUser('id') userId: string,
    @Body() dto: ClaimPromotionDto,
  ) {
    return this.authService.claimPromotion(userId, dto.promoCode, dto.metadata);
  }

  /**
   * Admin: Overview metrics for comebacks and campaign claims
   */
  @Get('admin/promotions/overview')
  @UseGuards(AdminGuard)
  async getAdminPromotionsOverview() {
    return this.authService.getAdminPromotionsOverview();
  }

  /**
   * Admin: Detailed paginated promotion claims list
   */
  @Get('admin/promotions/claims')
  @UseGuards(AdminGuard)
  async getAdminPromotionClaims(@Query() query: AdminPromotionClaimsQueryDto) {
    return this.authService.getAdminPromotionClaims(query);
  }

  /**
   * Admin: List all campaigns
   */
  @Get('admin/promotions/campaigns')
  @UseGuards(AdminGuard)
  async getPromotionCampaigns() {
    return this.authService.getPromotionCampaigns();
  }

  /**
   * Admin: Create a new promotion campaign
   */
  @Post('admin/promotions/campaigns')
  @UseGuards(AdminGuard)
  async createPromotionCampaign(@Body() dto: CreatePromotionCampaignDto) {
    return this.authService.createPromotionCampaign(dto);
  }

  /**
   * Admin: Update / Edit campaign details (rewards, audience, validity, status)
   */
  @Put('admin/promotions/campaigns/:id')
  @UseGuards(AdminGuard)
  async updatePromotionCampaign(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionCampaignDto,
  ) {
    return this.authService.updatePromotionCampaign(id, dto);
  }

  /**
   * Admin: Update campaign status (active, scheduled, ended, draft)
   */
  @Put('admin/promotions/campaigns/:id/status')
  @UseGuards(AdminGuard)
  async updateCampaignStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.authService.updateCampaignStatus(id, dto.status);
  }

  /**
   * Admin: Get targeted audience count for SMS broadcast
   */
  @Get('admin/sms-audience-count')
  @UseGuards(AdminGuard)
  async getSmsAudienceCount(@Query('audience') audience: 'all' | 'paid' | 'nonpaid') {
    return this.authService.getSmsAudienceCount(audience || 'all');
  }

  /**
   * Admin: Dispatch bulk or targeted broadcast SMS
   */
  @Post('admin/broadcast-sms')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async broadcastSms(@Body() dto: BroadcastSmsDto) {
    return this.authService.broadcastSms(dto);
  }

  /**
   * Admin: Get progress of background broadcast SMS job
   */
  @Get('admin/broadcast-sms/:jobId')
  @UseGuards(AdminGuard)
  async getBroadcastSmsJob(@Param('jobId') jobId: string) {
    const job = this.authService.getBroadcastSmsJob(jobId);
    if (!job) {
      throw new NotFoundException(`SMS Broadcast job with ID ${jobId} not found.`);
    }
    return job;
  }

  /**
   * Public: the web app reports a tracked SMS link open (?r=<token>). Tokens are random
   * 8-char codes (~10^14 space); unknown tokens are ignored.
   */
  @Post('track/sms-click')
  async trackSmsClick(@Body() body: { token?: string }) {
    return this.authService.recordSmsClick(String(body?.token || ''));
  }

  /**
   * Admin: SMS campaigns with sent / unique clicks / practised-after-click.
   */
  @Get('admin/sms-campaigns')
  @UseGuards(AdminGuard)
  async getSmsCampaigns(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.authService.getSmsCampaigns(readPage(page, pageSize));
  }

  /**
   * Admin: per-recipient click detail for one SMS campaign.
   */
  @Get('admin/sms-campaigns/:id')
  @UseGuards(AdminGuard)
  async getSmsCampaignRecipients(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.authService.getSmsCampaignRecipients(id, readPage(page, pageSize));
  }
}
