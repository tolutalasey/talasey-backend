// The forms an editor can send to their own inbox, in /content under "Where enquiries go".
export const ENQUIRY_FORMS = [
  'Contact form, any topic',
  'Contact form: A general question',
  'Contact form: Free samples',
  'Contact form: An order I have placed',
  'Contact form: A quote for a project',
  'Contact form: Photos of my finished garden',
  'Contact form: Becoming a stockist',
  'Contact form: Product question',
  'Site survey',
  'Find a stockist',
  'Find an installer',
  'Showroom visit',
  'Partner Programme',
  'Warranty registration',
] as const;

export type EnquiryForm = (typeof ENQUIRY_FORMS)[number];

const FORM_OF_KIND = {
  'site-survey': 'Site survey',
  stockist: 'Find a stockist',
  installer: 'Find an installer',
  showroom: 'Showroom visit',
  partner: 'Partner Programme',
  warranty: 'Warranty registration',
} as const;

// The most specific form first: a contact topic, then the contact form as a whole.
export function formsFor(kind: string, topic: string | null | undefined): string[] {
  if (kind === 'contact') {
    return [...(topic ? [`Contact form: ${topic}`] : []), 'Contact form, any topic'];
  }
  const form = FORM_OF_KIND[kind as keyof typeof FORM_OF_KIND];
  return form ? [form] : [];
}

// Who gets an enquiry: the inbox set for its form, or the default inbox.
export function inboxFor(
  inboxes: Record<string, unknown>[],
  kind: string,
  topic: string | null | undefined,
  fallback: string,
): string {
  for (const form of formsFor(kind, topic)) {
    const match = inboxes.find((entry) => entry.form === form);
    if (typeof match?.email === 'string' && match.email) return match.email;
  }
  return fallback;
}
