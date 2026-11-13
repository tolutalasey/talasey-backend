export interface Email {
  to: string;
  subject: string;
  body: string;
}

// How emails leave. Locally they are written to .data/outbox to read; an email service
// (Postmark, SES) replaces it in production by implementing this.
export interface Mailer {
  send(email: Email): Promise<void>;
}

export const MAILER = Symbol('Mailer');
