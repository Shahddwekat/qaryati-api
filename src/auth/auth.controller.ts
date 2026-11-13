
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with the CONTRIBUTOR role.',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid registration data.',
  })
  @ApiResponse({
    status: 409,
    description: 'Email is already registered.',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(
      dto.email,
      dto.password,
      dto.fullName,
    );
  }

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  @ApiOperation({
    summary: 'Login',
    description:
      'Authenticates a user and returns access and refresh tokens.',
  })
  @ApiResponse({
    status: 201,
    description: 'Login successful. Tokens are returned.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account.',
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many login attempts from this IP (LOGIN_RATE_LIMIT per LOGIN_RATE_TTL_MS). See the Retry-After header.',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(
      dto.email,
      dto.password,
    );
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Validates the refresh token, revokes it, and issues new tokens.',
  })
  @ApiResponse({
    status: 201,
    description: 'New access and refresh tokens issued.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is invalid, expired, or revoked.',
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes the provided refresh token.',
  })
  @ApiResponse({
    status: 201,
    description: 'Logout completed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data.',
  })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
