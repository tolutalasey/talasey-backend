import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { ContentModule } from './content/content.module.js';
import { ClockModule } from './common/clock.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DeliveryModule } from './delivery/delivery.module.js';
import { DeliveryAdminModule } from './delivery/zones/delivery-admin.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MailModule } from './mail/mail.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { SamplesModule } from './samples/samples.module.js';
import { SiteModule } from './site/site.module.js';
import { SlotsModule } from './slots/slots.module.js';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module.js';
import { StoreModule } from './store/store.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  imports: [
    ConfigModule,
    ClockModule,
    DatabaseModule,
    StoreModule,
    JobsModule,
    SiteModule,
    PaymentsModule,
    AuditModule,
    AuthModule,
    HealthModule,
    DeliveryModule,
    DeliveryAdminModule,
    SlotsModule,
    CatalogueModule,
    CheckoutModule,
    ContentModule,
    MailModule,
    UploadsModule,
    SamplesModule,
    StockAlertsModule,
    PromotionsModule,
  ],
})
export class AppModule {}
