// Validation rules as plain functions. Each returns the message an editor sees, or true when the
// value is fine.

export type Check = true | string;

export const SEO_TITLE = { min: 30, max: 60 } as const;
export const SEO_DESCRIPTION = { min: 70, max: 160 } as const;
export const GUIDE_REVIEW_MONTHS = 12;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEAR = /(?:^|-)(19|20)\d{2}(?:-|$)/;
const ID_LIKE = /\d{5,}|[a-f0-9]{8,}/;

export function slugCheck(slug: string | undefined): Check {
  if (!slug) return 'Add a URL slug';
  if (!SLUG.test(slug)) return 'Use lowercase letters, numbers and single hyphens only';
  if (YEAR.test(slug)) return 'Leave dates out of URLs so the page never looks out of date';
  if (ID_LIKE.test(slug)) return 'Leave codes and IDs out of URLs; use words people search for';
  if (slug.length > 80) return 'Keep the slug under 80 characters';
  return true;
}

export function lengthCheck(
  value: string | undefined,
  { min, max }: { min: number; max: number },
  what: string,
): Check {
  const length = value?.trim().length ?? 0;
  if (length === 0) return `Add the ${what}`;
  if (length < min) return `Make the ${what} at least ${min} characters (now ${length})`;
  if (length > max) return `Keep the ${what} to ${max} characters (now ${length})`;
  return true;
}

export interface RedirectValue {
  from?: string;
  to?: string;
}

export function redirectCheck(redirect: RedirectValue | undefined): Check {
  const from = redirect?.from?.trim();
  const to = redirect?.to?.trim();
  if (!from || !to) return 'Add both the old path and where it goes';
  if (!from.startsWith('/')) return 'The old path starts with /, like /porcelain-tiles.html';
  if (!to.startsWith('/') && !/^https:\/\//.test(to)) {
    return 'Send it to a path on this site (/...) or a full https:// address';
  }
  if (from.replace(/\/$/, '') === to.replace(/\/$/, '')) return 'A page cannot redirect to itself';
  return true;
}

export function reviewDueCheck(reviewedOn: string | undefined, today = new Date()): Check {
  if (!reviewedOn) return 'Add the date the technical team last checked this guide';
  const due = new Date(reviewedOn);
  due.setMonth(due.getMonth() + GUIDE_REVIEW_MONTHS);
  return due >= today ? true : 'This guide is due its yearly technical review';
}
