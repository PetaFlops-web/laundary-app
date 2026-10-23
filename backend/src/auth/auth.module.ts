import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { requireEnv } from '../common/config/env.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

type ExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireEnv('JWT_ACCESS_SECRET'),
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as ExpiresIn,
      },
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
