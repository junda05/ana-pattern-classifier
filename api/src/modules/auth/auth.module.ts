/**
 * Authentication and authorization module
 *
 * Main features:
 * - Full JWT (JSON Web Token) configuration
 * - Passport.js integration for the authentication strategies
 * - Token blacklist for secure logout
 * - Password recovery with short-lived tokens
 * - Email delivery through SendGrid
 * - Controllers for the authentication endpoints
 * - Per-IP rate limits of the login, refresh and password-reset routes
 *   (ThrottlerModule, configured by AUTH_RATE_LIMIT_*; see auth-rate-limit.ts)
 *
 * Services:
 * - AuthService: core authentication logic
 * - PasswordService: secure password hashing and comparison
 * - TokenBlacklistService: management of revoked tokens
 * - PasswordResetService: password recovery
 * - EmailService: email delivery through SendGrid (optional)
 * - AuthTokenCleanupService: hourly cleanup of expired/used tokens
 *
 * Passport strategies:
 * - LocalStrategy: username/password authentication
 * - JwtStrategy: JWT validation on protected routes
 *
 * JWT configuration:
 * - Secret read from the JWT_SECRET environment variable
 * - Configurable expiration times:
 *   · JWT_ACCESS_EXPIRATION: access token (default: 15m)
 *   · JWT_REFRESH_EXPIRATION: refresh token (default: 7d)
 *
 * Exports:
 * - TokenBlacklistService: for use in other modules
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { DatabaseModule } from '../database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { PassportAuthController } from './passport-auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordService } from './password.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { PasswordResetService } from './password-reset.service';
import { EmailService } from './email.service';
import { AuthTokenCleanupService } from './auth-token-cleanup.service';
import { blacklistedTokenProviders } from './blacklisted-token.providers';
import { passwordResetTokenProviders } from '../../entities/auth/password-reset-token.providers';
import { authThrottlerOptions } from './auth-rate-limit';

@Module({
  providers: [
    ...blacklistedTokenProviders,
    ...passwordResetTokenProviders,
    AuthService,
    LocalStrategy,
    JwtStrategy,
    PasswordService,
    TokenBlacklistService,
    PasswordResetService,
    EmailService,
    AuthTokenCleanupService,
  ],
  controllers: [PassportAuthController],
  imports: [
    DatabaseModule,
    UsersModule,
    TraceabilityModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
    PassportModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: authThrottlerOptions,
    }),
  ],
  exports: [TokenBlacklistService],
})
export class AuthModule {}
