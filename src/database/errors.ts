const codeOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;

// Drizzle wraps the driver's error, so look at its cause too.
export function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return codeOf(error) === '23505' || codeOf(cause) === '23505';
}
