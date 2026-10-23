import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService, type UserProfileData } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { GetUser } from './decorators/get-user.decorator.js';
import {
  SendOtpDto,
  VerifyOtpDto,
  SavePreferencesDto,
  UpgradePlanDto,
  AddOnTopUpDto,
  UpdateStepDto,
  AdminUsersQueryDto,
  AdminUpdateUserDto,
  UpdateAppConfigDto,
  CreateTestAccountDto,
} from './dto/auth.dto.js';

@Controller('v1')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/otp/send')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('auth/otp/verify')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Get('auth/me')
  @UseGuards(AuthGuard)
  async getMe(@GetUser() user: UserProfileData) {
    return { success: true, profile: user };
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
    return this.authService.updateStep(userId, dto.step);
  }

  @Post('plans/upgrade')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async upgradePlan(
    @Body() dto: UpgradePlanDto,
    @GetUser('id') userId: string,
  ) {
    return this.authService.upgradePlan(userId, dto);
  }

  @Post('plans/top-up')
  @UseGuards(AuthGuard)
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

  /**
   * Admin: List users with analytics and usage metrics
   */
  @Get('admin/users')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getAdminUsers(@Query() query: AdminUsersQueryDto) {
    return this.authService.getAdminUsers(query);
  }

  /**
   * Admin: Get comprehensive personalized user profile with sessions and learning stats
   */
  @Get('admin/users/:id')
  async getAdminUserDetail(@Param('id') userId: string) {
    return this.authService.getAdminUserDetail(userId);
  }

  /**
   * Admin: Update user's minutes allowance, tier, or personalized goals
   */
  @Put('admin/users/:id')
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
  async getAdminAppConfig() {
    return this.authService.getAppConfig();
  }

  /**
   * Admin: Update application configuration
   */
  @Put('admin/app-config')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateAppConfig(@Body() dto: UpdateAppConfigDto) {
    return this.authService.updateAppConfig(dto);
  }

  /**
   * Admin: List all test accounts
   */
  @Get('admin/test-accounts')
  async getTestAccounts() {
    return this.authService.getTestAccounts();
  }

  /**
   * Admin: Create and provision a new test account
   */
  @Post('admin/test-accounts')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createTestAccount(@Body() dto: CreateTestAccountDto) {
    return this.authService.createTestAccount(dto);
  }

  /**
   * Admin: Delete/remove a test account
   */
  @Delete('admin/test-accounts/:id')
  async deleteTestAccount(@Param('id') id: string) {
    return this.authService.deleteTestAccount(id);
  }
}

