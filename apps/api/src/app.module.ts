import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OriginVerifyGuard } from './common/origin-verify.guard';
import { ConfigModule } from './config';
import { ContactModule } from './contact/contact.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule, ContactModule],
  controllers: [HealthController],
  providers: [
    // Every route requires the CloudFront origin header — secure by default,
    // so a new controller can't accidentally be left reachable directly.
    { provide: APP_GUARD, useClass: OriginVerifyGuard },
  ],
})
export class AppModule {}
