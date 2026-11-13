import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Email, Mailer } from './mailer.js';

export class OutboxMailer implements Mailer {
  constructor(private readonly directory: string) {}

  async send({ to, subject, body }: Email) {
    const folder = resolve(this.directory);
    await mkdir(folder, { recursive: true });
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${to.replace(/[^\w.@-]/g, '')}.txt`;
    await writeFile(join(folder, name), `To: ${to}\nSubject: ${subject}\n\n${body}\n`);
  }
}
