import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  SendOtpDto,
  VerifyOtpDto,
  SavePreferencesDto,
  UpgradePlanDto,
  AddOnTopUpDto,
  UpdateStepDto,
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
  async getMe(@Headers('authorization') authHeader?: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    const profile = await this.authService.getProfile(userId);
    return { success: true, profile };
  }

  @Post('users/onboarding-preferences')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async savePreferences(
    @Body() dto: SavePreferencesDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    return this.authService.savePreferences(userId, dto);
  }

  @Post('users/step')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateStep(
    @Body() dto: UpdateStepDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    return this.authService.updateStep(userId, dto.step);
  }

  @Post('plans/upgrade')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async upgradePlan(
    @Body() dto: UpgradePlanDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    return this.authService.upgradePlan(userId, dto);
  }

  @Post('plans/top-up')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async addOnTopUp(
    @Body() dto: AddOnTopUpDto,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const userId = this.authService.validateAuthToken(authHeader);
    return this.authService.addOnTopUp(userId, dto);
  }

  @Get('plans')
  getPlans() {
    return this.authService.getPlansCatalog();
  }
}
