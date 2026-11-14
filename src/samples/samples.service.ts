import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Actor } from '../audit/audit-log.js';
import { CLOCK, type Clock } from '../common/clock.js';
import { parsePostcode } from '../delivery/postcode.js';
import { JobQueue } from '../jobs/job-queue.js';
import { EmailWording, type EmailName } from '../mail/email-wording.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { SiteRefresh } from '../site/site-refresh.service.js';
import { SamplesRepository, type SampleRequestRow } from './samples.repository.js';
import type { SampleRequestInput } from './samples.schemas.js';

const SAMPLE_EMAIL = 'sample-email';
// The site caches the samples it offers under this tag.
const SAMPLES_TAG = 'samples';

export type SampleRequestResult =
  { status: 'placed'; request: SampleRequestRow } | { status: 'invalid'; problems: string[] };

export type OfferResult = { status: 'ok'; id: string } | { status: 'invalid'; problem: string };

const listOf = (request: SampleRequestRow) =>
  request.items.map((item) => `- ${item.productTitle}: ${item.label}`).join('\n');

@Injectable()
export class SamplesService implements OnModuleInit {
  constructor(
    private readonly samples: SamplesRepository,
    private readonly jobs: JobQueue,
    private readonly wording: EmailWording,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly site: SiteRefresh,
  ) {}

  onModuleInit() {
    this.jobs.handle<{ requestId: string; email: EmailName }>(SAMPLE_EMAIL, (job) =>
      this.sendEmail(job.requestId, job.email),
    );
  }

  offers(forShop: boolean) {
    return this.samples.offers({ forShop });
  }

  async createOffer(productHandle: string, label: string): Promise<OfferResult> {
    const productId = await this.samples.productIdByHandle(productHandle);
    if (!productId)
      return { status: 'invalid', problem: `No product at /products/${productHandle}/` };
    const id = await this.samples.createOffer(productId, label);
    await this.site.refresh([SAMPLES_TAG]);
    return { status: 'ok', id };
  }

  async updateOffer(id: string, changes: { label?: string; active?: boolean }) {
    const updated = await this.samples.updateOffer(id, changes);
    if (updated) await this.site.refresh([SAMPLES_TAG]);
    return updated;
  }

  async deleteOffer(id: string) {
    const deleted = await this.samples.deleteOffer(id);
    if (deleted) await this.site.refresh([SAMPLES_TAG]);
    return deleted;
  }

  async request(input: SampleRequestInput): Promise<SampleRequestResult> {
    const postcode = parsePostcode(input.address.postcode);
    if (!postcode) return { status: 'invalid', problems: ['Enter a UK postcode, like M1 1AE'] };

    const offers = await this.samples.offersByIds(input.offerIds);
    const available = offers.filter((offer) => offer.active);
    if (available.length !== input.offerIds.length) {
      return {
        status: 'invalid',
        problems: ['One of your samples is no longer offered. Take it out and try again.'],
      };
    }

    const request = await this.samples.createRequest({
      email: input.email.trim().toLowerCase(),
      address: { ...input.address, postcode: postcode.formatted },
      items: input.offerIds.map((id) => {
        const offer = available.find((candidate) => candidate.id === id);
        return {
          offerId: id,
          productTitle: offer?.productTitle ?? '',
          productHandle: offer?.productHandle ?? '',
          label: offer?.label ?? '',
        };
      }),
      marketingConsent: input.marketingConsent,
    });
    await this.jobs.enqueue(SAMPLE_EMAIL, { requestId: request.id, email: 'samples-requested' });
    return { status: 'placed', request };
  }

  requests(status?: 'new' | 'dispatched') {
    return this.samples.requests(status);
  }

  async dispatch(id: string, actor: Actor): Promise<SampleRequestRow | null> {
    const request = await this.samples.dispatch(id, actor.name, this.clock());
    if (request)
      await this.jobs.enqueue(SAMPLE_EMAIL, { requestId: request.id, email: 'samples-dispatched' });
    return request;
  }

  private async sendEmail(requestId: string, name: EmailName) {
    const request = await this.samples.findRequest(requestId);
    if (!request) return;
    const email = await this.wording.render(name, {
      name: request.address.firstName,
      requestNumber: `#S${request.number}`,
      samples: listOf(request),
    });
    await this.mailer.send({ to: request.email, ...email });
  }
}
