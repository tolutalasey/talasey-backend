import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';
import type { Database } from '../database/client.js';
import { DATABASE } from '../database/database.module.js';
import { enquiries, products } from '../database/schema/index.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { FILE_STORAGE, type FileStorage } from '../uploads/file-storage.js';
import {
  MAX_ENQUIRY_PHOTO_BYTES,
  MAX_ENQUIRY_PHOTOS,
  type EnquiryDto,
  type EnquiryInput,
} from './enquiries.schemas.js';
import { photoKind } from './photos.js';
import { formatPostcode, postcodeProblem } from './postcodes.js';

type EnquiryRow = typeof enquiries.$inferSelect;

export type SubmitResult = { ok: true; id: string } | { ok: false; problems: string[] };

const toDto = (row: EnquiryRow): EnquiryDto => ({
  id: row.id,
  kind: row.kind as EnquiryDto['kind'],
  name: row.name,
  email: row.email,
  phone: row.phone,
  postcode: row.postcode,
  productHandle: row.productHandle,
  productTitle: row.productTitle,
  topic: row.topic,
  message: row.message,
  answers: row.answers,
  photoCount: row.photos.length,
  consent: row.consent,
  status: row.status as EnquiryDto['status'],
  createdAt: row.createdAt.toISOString(),
});

type Kind = EnquiryDto['kind'];

// How each kind of enquiry is named in the emails, and what the customer is told happens next.
const WORDING: Record<Kind, { what: string; subject: string; reply: string }> = {
  contact: {
    what: 'message',
    subject: 'Website message',
    reply: "We'll get back to you as soon as we can.",
  },
  'site-survey': {
    what: 'site survey request',
    subject: 'Site survey request',
    reply: "We'll be in touch within 2 working days to arrange a visit.",
  },
  stockist: {
    what: 'stockist request',
    subject: 'Stockist request',
    reply: "We'll email you the stockists nearest to you within one working day.",
  },
  installer: {
    what: 'installer request',
    subject: 'Installer request',
    reply: "We'll put you in touch with an approved installer near you within 2 working days.",
  },
  showroom: {
    what: 'showroom visit request',
    subject: 'Showroom visit request',
    reply: "We'll check availability and confirm your visit within one working day.",
  },
};

// These need a postcode and a phone number, so the team can find someone local and call back.
const LOCAL: Kind[] = ['site-survey', 'stockist', 'installer', 'showroom'];

@Injectable()
export class EnquiriesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // Saved first, so a failed email never loses an enquiry; then the inbox and the customer are
  // emailed.
  async submit(input: EnquiryInput, photos: Buffer[]): Promise<SubmitResult> {
    if (input.website) return { ok: true, id: randomUUID() };
    const problems: string[] = [];
    if (photos.length > MAX_ENQUIRY_PHOTOS)
      problems.push(`Send up to ${MAX_ENQUIRY_PHOTOS} photos.`);
    if (photos.some((photo) => photo.length > MAX_ENQUIRY_PHOTO_BYTES)) {
      problems.push('Each photo must be under 5 MB.');
    }
    const kinds = photos.map(photoKind);
    const known = kinds.filter((kind): kind is NonNullable<typeof kind> => kind !== null);
    if (known.length < kinds.length) problems.push('Send photos as JPEG, PNG, WebP or HEIC.');

    const productTitle = input.productHandle ? await this.productTitle(input.productHandle) : null;
    if (LOCAL.includes(input.kind)) {
      if (!input.phone) problems.push('Enter your phone number.');
      const postcode = postcodeProblem(input.postcode ?? '');
      if (postcode) problems.push(postcode);
    }
    if (input.kind === 'site-survey' && !productTitle) {
      problems.push('That product is no longer available.');
    }
    if (input.kind === 'contact' && (!input.message || input.message.length < 10)) {
      problems.push('Tell us a little more, at least 10 characters.');
    }
    if (problems.length > 0) return { ok: false, problems };

    const id = randomUUID();
    const paths = await Promise.all(
      known.map(async (kind, index) => {
        const path = `enquiries/${id}/${index + 1}.${kind.extension}`;
        await this.storage.save(path, photos[index] as Buffer, kind.contentType);
        return path;
      }),
    );
    const [row] = await this.db
      .insert(enquiries)
      .values({
        id,
        kind: input.kind,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        postcode: input.postcode ? formatPostcode(input.postcode) : null,
        productHandle: input.productHandle ?? null,
        productTitle,
        topic: input.topic ?? null,
        message: input.message ?? null,
        answers: input.answers,
        photos: paths,
        consent: input.consent,
      })
      .returning();
    if (row) await this.email(toDto(row));
    return { ok: true, id };
  }

  async list(): Promise<EnquiryDto[]> {
    const rows = await this.db
      .select()
      .from(enquiries)
      .orderBy(desc(enquiries.createdAt))
      .limit(300);
    return rows.map(toDto);
  }

  async find(id: string): Promise<EnquiryDto | null> {
    const [row] = await this.db.select().from(enquiries).where(eq(enquiries.id, id));
    return row ? toDto(row) : null;
  }

  async photo(id: string, number: number): Promise<{ bytes: Buffer; contentType: string } | null> {
    const [row] = await this.db
      .select({ photos: enquiries.photos })
      .from(enquiries)
      .where(eq(enquiries.id, id));
    const path = row?.photos[number - 1];
    const bytes = path ? await this.storage.read(path) : null;
    const kind = bytes && photoKind(bytes);
    return bytes && kind ? { bytes, contentType: kind.contentType } : null;
  }

  async setStatus(id: string, status: EnquiryDto['status']): Promise<EnquiryDto | null> {
    const [row] = await this.db
      .update(enquiries)
      .set({ status })
      .where(eq(enquiries.id, id))
      .returning();
    return row ? toDto(row) : null;
  }

  private async productTitle(handle: string): Promise<string | null> {
    const [product] = await this.db
      .select({ title: products.title, published: products.published })
      .from(products)
      .where(eq(products.handle, handle));
    return product?.published ? product.title : null;
  }

  private async email(enquiry: EnquiryDto) {
    const lines = [
      enquiry.productTitle && `Product: ${enquiry.productTitle}`,
      `Name: ${enquiry.name}`,
      `Email: ${enquiry.email}`,
      enquiry.phone && `Phone: ${enquiry.phone}`,
      enquiry.postcode && `Postcode: ${enquiry.postcode}`,
      enquiry.topic && `About: ${enquiry.topic}`,
      ...Object.entries(enquiry.answers).map(([question, answer]) => `${question}: ${answer}`),
      enquiry.message && `\n${enquiry.message}`,
      `\nPhotos: ${enquiry.photoCount}`,
      `Happy to be contacted: ${enquiry.consent ? 'yes' : 'no'}`,
      `\nOpen it in the admin: ${this.config.WEB_URL}/admin/enquiries/${enquiry.id}/`,
    ].filter(Boolean);
    const wording = WORDING[enquiry.kind];
    const subject = [
      `${wording.subject} from ${enquiry.name}`,
      enquiry.productTitle && `: ${enquiry.productTitle}`,
      enquiry.postcode && ` (${enquiry.postcode})`,
    ]
      .filter(Boolean)
      .join('');
    await this.mailer.send({ to: this.config.ENQUIRIES_TO, subject, body: lines.join('\n') });
    await this.mailer.send({
      to: enquiry.email,
      subject: `We've received your ${wording.what}`,
      body: [
        `Hello ${enquiry.name},`,
        '',
        enquiry.productTitle
          ? `Thank you for asking about the ${enquiry.productTitle}. ${wording.reply}`
          : `Thank you. ${wording.reply}`,
        '',
        'Talasey',
        '0330 333 8030',
      ].join('\n'),
    });
  }
}
