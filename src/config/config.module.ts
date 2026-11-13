import { Global, Module } from '@nestjs/common';
import { parseConfig } from './config.schema.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => parseConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
