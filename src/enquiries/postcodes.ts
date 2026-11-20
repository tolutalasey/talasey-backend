const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

// Areas outside mainland Great Britain: Northern Ireland, the Isle of Man, the Channel Islands,
// the Western Isles, Orkney, Shetland and the Isles of Scilly. The full list is still to be
// confirmed by Talasey.
const OFF_MAINLAND = [/^(BT|IM|GY|JE|HS|ZE)\d/, /^KW1[5-7]$/, /^TR2[1-5]$/];

export const normalisePostcode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

export function postcodeProblem(value: string): string | null {
  const postcode = normalisePostcode(value);
  if (!postcode) return 'Enter the postcode where the work will be done.';
  if (!FULL_POSTCODE.test(postcode)) return 'Enter a full UK postcode, like DN15 8QT.';
  const outward = postcode.slice(0, -3);
  if (OFF_MAINLAND.some((area) => area.test(outward))) {
    return 'We install in mainland UK only, and this postcode is outside that area.';
  }
  return null;
}

export const formatPostcode = (value: string) => {
  const postcode = normalisePostcode(value);
  return `${postcode.slice(0, -3)} ${postcode.slice(-3)}`;
};
