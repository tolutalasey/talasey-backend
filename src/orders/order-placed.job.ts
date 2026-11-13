import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { JobQueue } from '../jobs/job-queue.js';
import { EmailWording } from '../mail/email-wording.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { SlotsService } from '../slots/slots.service.js';
import { OrderRepository } from './order.repository.js';

export const ORDER_PLACED = 'order-placed';

// Books the held pallet day once the order exists. A hold that lapsed while the customer paid can
// still be booked if the day has room; when it can't, the order stands and the day is flagged for
// the team to rebook by phone.
@Injectable()
export class OrderPlacedJob implements OnModuleInit {
  private readonly logger = new Logger(OrderPlacedJob.name);

  constructor(
    private readonly jobs: JobQueue,
    private readonly orders: OrderRepository,
    private readonly slots: SlotsService,
    private readonly wording: EmailWording,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  onModuleInit() {
    this.jobs.handle<{ orderId: string }>(ORDER_PLACED, async ({ orderId }) => {
      await this.bookDay(orderId);
      await this.confirm(orderId);
    });
  }

  private async confirm(orderId: string) {
    const order = await this.orders.find(orderId);
    if (!order) return;
    const day = order.slot
      ? order.slot.status === 'booked'
        ? `Your pallet arrives on ${order.slot.date}.`
        : 'We will call you to agree a delivery day.'
      : 'We will email you when it is on its way.';
    const email = await this.wording.render('order-confirmation', {
      name: order.address.firstName,
      orderNumber: `#${order.number}`,
      deliveryDay: day,
    });
    await this.mailer.send({ to: order.email, ...email });
  }

  async bookDay(orderId: string) {
    const order = await this.orders.find(orderId);
    const slot = order?.slot;
    if (!order || !slot || slot.status !== 'held') return;

    const outcome = await this.slots.confirm(slot.holdId);
    if (outcome.status === 'booked') {
      await this.orders.setSlot(orderId, { ...slot, date: outcome.hold.date, status: 'booked' });
      return;
    }
    this.logger.warn(`Order #${order.number}: ${slot.date} could not be booked. Call to rebook.`);
    await this.orders.setSlot(orderId, { ...slot, status: 'needs-rebooking' });
  }
}
