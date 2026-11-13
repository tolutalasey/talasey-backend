import { Global, Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { EmailWording } from './email-wording.js';
import { MAILER } from './mailer.js';
import { OutboxMailer } from './outbox-mailer.js';

@Global()
@Module({
  imports: [ContentModule],
  providers: [{ provide: MAILER, useValue: new OutboxMailer('.data/outbox') }, EmailWording],
  exports: [MAILER, EmailWording],
})
export class MailModule {}
