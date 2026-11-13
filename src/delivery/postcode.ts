const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/;

export interface Postcode {
  outward: string;
  inward: string;
  area: string;
  formatted: string;
}

export function parsePostcode(input: string): Postcode | null {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  const match = UK_POSTCODE.exec(compact);
  if (!match) return null;

  const [, outward = '', inward = ''] = match;
  const area = outward.replace(/\d.*$/, '');
  return { outward, inward, area, formatted: `${outward} ${inward}` };
}

export function isValidPostcode(input: string): boolean {
  return parsePostcode(input) !== null;
}
