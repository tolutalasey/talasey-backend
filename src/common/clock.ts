import { Global, Module } from '@nestjs/common';

export type Clock = () => Date;

export const CLOCK = Symbol('Clock');

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: () => new Date() }],
  exports: [CLOCK],
})
export class ClockModule {}
