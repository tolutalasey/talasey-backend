import { randomBytes } from 'node:crypto';
import { parseConfig } from '../config/config.schema.js';
import { createDatabase } from '../database/client.js';
import { isUniqueViolation } from '../database/errors.js';
import { staffUsers } from '../database/schema/index.js';
import { hashPassword } from './password.js';

// The first owner of a real (non-demo) setup: npm run staff:create-owner -- <email> "<name>".
// Prints a one-off password once; the owner signs in, changes it and turns on two-factor.
const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();

if (!email?.includes('@') || !name) {
  console.error('Usage: npm run staff:create-owner -- <email> "<full name>"');
  process.exit(1);
}

const password = randomBytes(15).toString('base64url');
const { db, close } = createDatabase(parseConfig(process.env).DATABASE_URL);
try {
  await db.insert(staffUsers).values({
    email: email.trim().toLowerCase(),
    name,
    role: 'owner',
    passwordHash: await hashPassword(password),
  });
  process.stdout.write(
    `${[
      `Created owner ${name} <${email}>.`,
      `One-off password: ${password}`,
      'It is shown only now. Sign in at /admin, change it under Your account, and turn on two-factor.',
    ].join('\n')}\n`,
  );
} catch (error) {
  if (!isUniqueViolation(error)) throw error;
  console.error(`${email} already has an account.`);
  process.exitCode = 1;
} finally {
  await close();
}
