import { Injectable } from '@nestjs/common';
import { ContentService } from '../content/content.service.js';

export type EmailName =
  | 'order-confirmation'
  | 'delivery-day-booked'
  | 'enquiry-received'
  | 'samples-requested'
  | 'samples-dispatched'
  | 'back-in-stock'
  | 'sign-in-link';

const FALLBACK: Record<EmailName, { subject: string; body: string }> = {
  'order-confirmation': {
    subject: 'Your Talasey order {orderNumber}',
    body: 'Hello {name},\n\nThank you for your order {orderNumber}. {deliveryDay}\n\nThe Talasey team',
  },
  'delivery-day-booked': {
    subject: 'Your delivery day is booked',
    body: 'Hello {name},\n\n{deliveryDay}\n\nThe Talasey team',
  },
  'samples-requested': {
    subject: 'Your free samples {requestNumber}',
    body: 'Hello {name},\n\nThank you. We post samples the next working day and email you when they are on their way:\n\n{samples}\n\nThe Talasey team',
  },
  'samples-dispatched': {
    subject: 'Your samples are on their way',
    body: 'Hello {name},\n\nYour samples {requestNumber} are in the post:\n\n{samples}\n\nWhen you have seen them in your garden, reply to this email with any questions.\n\nThe Talasey team',
  },
  'back-in-stock': {
    subject: "It's back: {product}",
    body: 'Hello,\n\nYou asked us to tell you when {product} was back. It is in stock now:\n\n{link}\n\nWe only emailed because you asked, and we will not email about it again.\n\nThe Talasey team',
  },
  'sign-in-link': {
    subject: 'Your link to sign in to Talasey',
    body: 'Hello,\n\nUse this link to see your orders and samples. It works once, for {minutes} minutes:\n\n{link}\n\nIf you did not ask for it, you can ignore this email.\n\nThe Talasey team',
  },
  'enquiry-received': {
    subject: 'We have your enquiry',
    body: 'Hello {name},\n\nThank you. We will reply within one working day.\n\nThe Talasey team',
  },
};

// The wording editors publish in /content, with {placeholders} filled in.
@Injectable()
export class EmailWording {
  constructor(private readonly content: ContentService) {}

  async render(name: EmailName, values: Record<string, string>) {
    const published = (await this.content.published('email')).find((entry) => entry.email === name);
    const wording =
      typeof published?.subject === 'string' && typeof published.body === 'string'
        ? { subject: published.subject, body: published.body }
        : FALLBACK[name];
    const fill = (text: string) =>
      text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
    return { subject: fill(wording.subject), body: fill(wording.body) };
  }
}
