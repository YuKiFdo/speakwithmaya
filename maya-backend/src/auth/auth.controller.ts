import {
  Controller,
  Post,
  Get,
  Body,
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
}
