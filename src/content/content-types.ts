import { z } from 'zod';
import {
  lengthCheck,
  redirectCheck,
  SEO_DESCRIPTION,
  SEO_TITLE,
  slugCheck,
  type Check,
} from './content-rules.js';

// How an editor fills a field in /content. The form is drawn from these, so adding a field here
// is all it takes to make it editable.
export type Field =
  | {
      name: string;
      label: string;
      kind: 'text' | 'textarea' | 'date' | 'boolean' | 'list';
      help?: string;
    }
  | { name: string; label: string; kind: 'select'; options: readonly string[]; help?: string }
  | { name: string; label: string; kind: 'group' | 'items'; fields: Field[]; help?: string }
  | { name: string; label: string; kind: 'image'; help?: string };

export interface ContentType {
  type: string;
  label: string;
  // One document of this type (home page, navigation), or many keyed by a field.
  singleton: boolean;
  keyField: string | null;
  // Only the owner publishes these (legal and finance wording).
  locked: boolean;
  fields: Field[];
  schema: z.ZodType;
}

const toZod = (check: (value: string) => Check) => (value: string, ctx: z.RefinementCtx) => {
  const result = check(value);
  if (result !== true) ctx.addIssue({ code: 'custom', message: result });
};

const required = (label: string) =>
  z
    .string({ error: `Add the ${label}` })
    .trim()
    .min(1, `Add the ${label}`);
const slug = z.string({ error: 'Add a URL slug' }).superRefine(toZod(slugCheck));
const optionalText = z.string().trim().nullish();
const list = z.array(z.string().trim().min(1)).default([]);
const seo = z.object({
  title: z.string().superRefine(toZod((value) => lengthCheck(value, SEO_TITLE, 'search title'))),
  description: z
    .string()
    .superRefine(toZod((value) => lengthCheck(value, SEO_DESCRIPTION, 'search description'))),
});
const link = z.object({ label: required('link text'), href: required('link address') });
const faqItem = z.object({ question: required('question'), answer: required('answer') });
const image = z.object({
  src: required('photo'),
  alt: z.string().trim(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const seoField: Field = {
  name: 'seo',
  label: 'Search engine text',
  kind: 'group',
  fields: [
    { name: 'title', label: 'Title (30 to 60 characters)', kind: 'text' },
    { name: 'description', label: 'Description (70 to 160 characters)', kind: 'textarea' },
  ],
};
const slugField: Field = {
  name: 'slug',
  label: 'Web address',
  kind: 'text',
  help: 'Lower-case words joined by hyphens, like dusk-grey-porcelain',
};
const faqsField: Field = {
  name: 'faqs',
  label: 'Questions and answers',
  kind: 'items',
  fields: [
    { name: 'question', label: 'Question', kind: 'text' },
    { name: 'answer', label: 'Answer', kind: 'textarea' },
  ],
};
const linkFields: Field[] = [
  { name: 'label', label: 'Link text', kind: 'text' },
  {
    name: 'href',
    label: 'Goes to',
    kind: 'text',
    help: 'A path on the site, like /help/delivery/',
  },
];

export const GUIDE_TOPICS = ['Planning', 'Buying', 'Laying', 'Care'] as const;
export const FAQ_TOPICS = ['Delivery', 'Returns', 'Laying', 'Care', 'Finance', 'Samples'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const EMAILS = [
  'order-confirmation',
  'delivery-day-booked',
  'enquiry-received',
  'samples-requested',
  'samples-dispatched',
  'back-in-stock',
] as const;

const pageFields = (extra: Field[] = []): Field[] => [
  { name: 'name', label: 'Name', kind: 'text' },
  slugField,
  { name: 'h1', label: 'Main heading', kind: 'text' },
  { name: 'intro', label: 'Introduction', kind: 'textarea' },
  {
    name: 'story',
    label: 'Story',
    kind: 'textarea',
    help: 'Leave a blank line between paragraphs',
  },
  {
    name: 'facts',
    label: 'Facts',
    kind: 'items',
    fields: [
      { name: 'label', label: 'Label', kind: 'text' },
      { name: 'value', label: 'Value', kind: 'text' },
    ],
  },
  { name: 'points', label: 'Key points', kind: 'list', help: 'One per line' },
  {
    name: 'ranges',
    label: 'Ranges to show',
    kind: 'list',
    help: 'Range web addresses, one per line',
  },
  ...extra,
  faqsField,
  {
    name: 'placeholder',
    label: 'Placeholder copy',
    kind: 'boolean',
    help: 'Tick while the text is a stand-in; the page stays out of search engines',
  },
  seoField,
];

const pageSchema = z.object({
  name: required('name'),
  slug,
  h1: required('main heading'),
  intro: required('introduction'),
  story: optionalText,
  facts: z.array(z.object({ label: required('label'), value: required('value') })).default([]),
  points: list,
  ranges: list,
  faqs: z.array(faqItem).default([]),
  placeholder: z.boolean().default(false),
  seo,
});

const wording = (type: string, label: string): ContentType => ({
  type,
  label,
  singleton: false,
  keyField: 'key',
  locked: true,
  fields: [
    { name: 'key', label: 'Name', kind: 'text', help: 'Like returns-policy or finance-example' },
    { name: 'title', label: 'Title', kind: 'text' },
    { name: 'body', label: 'Approved wording', kind: 'textarea' },
    { name: 'approvedBy', label: 'Approved by', kind: 'text' },
    { name: 'approvedOn', label: 'Approved on', kind: 'date' },
  ],
  schema: z.object({
    key: slug,
    title: required('title'),
    body: required('wording'),
    approvedBy: required('name of who approved it'),
    approvedOn: z.iso.date({ error: 'Add the date it was approved' }),
  }),
});

export const CONTENT_TYPES: ContentType[] = [
  {
    type: 'home',
    label: 'Homepage',
    singleton: true,
    keyField: null,
    locked: false,
    fields: [
      { name: 'h1', label: 'Main heading', kind: 'text' },
      { name: 'intro', label: 'Introduction', kind: 'textarea' },
      {
        name: 'heroActions',
        label: 'Buttons under the heading (two)',
        kind: 'items',
        fields: linkFields,
      },
      {
        name: 'projectTiles',
        label: 'Project tiles',
        kind: 'items',
        fields: [
          { name: 'title', label: 'Title', kind: 'text' },
          { name: 'summary', label: 'Summary', kind: 'textarea' },
          { name: 'href', label: 'Goes to', kind: 'text' },
        ],
      },
      {
        name: 'seasonalBlocks',
        label: 'Seasonal blocks',
        kind: 'items',
        help: 'The block for the current season shows on the homepage',
        fields: [
          { name: 'season', label: 'Season', kind: 'select', options: SEASONS },
          { name: 'heading', label: 'Heading', kind: 'text' },
          { name: 'text', label: 'Text', kind: 'textarea' },
          { name: 'action', label: 'Button', kind: 'group', fields: linkFields },
        ],
      },
      { name: 'featuredHeading', label: 'Featured products heading', kind: 'text' },
      {
        name: 'products',
        label: 'Featured products',
        kind: 'list',
        help: 'Product web addresses, one per line',
      },
      seoField,
    ],
    schema: z.object({
      h1: required('main heading'),
      intro: required('introduction'),
      heroActions: z.array(link).length(2, 'Add exactly two buttons'),
      projectTiles: z
        .array(
          z.object({
            title: required('title'),
            summary: required('summary'),
            href: required('link'),
          }),
        )
        .min(2, 'Add at least two project tiles'),
      seasonalBlocks: z
        .array(
          z.object({
            season: z.enum(SEASONS),
            heading: required('heading'),
            text: required('text'),
            action: link,
          }),
        )
        .default([]),
      featuredHeading: required('featured products heading'),
      products: list,
      seo,
    }),
  },
  {
    type: 'brand-page',
    label: 'Brand pages',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: pageFields(),
    schema: pageSchema,
  },
  {
    type: 'project-page',
    label: 'Project pages',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: pageFields([
      { name: 'steps', label: 'Steps', kind: 'list', help: 'One step per line' },
    ]),
    schema: pageSchema.extend({ steps: list }),
  },
  {
    type: 'product-extras',
    label: 'Product extras',
    singleton: false,
    keyField: 'product',
    locked: false,
    fields: [
      {
        name: 'product',
        label: 'Product',
        kind: 'text',
        help: "The end of the product's web address, like silver-grey-porcelain-paving",
      },
      {
        name: 'completeTheJob',
        label: 'Complete the job',
        kind: 'items',
        help: 'Products that go with it, each with its own add button. Never ticked for the customer.',
        fields: [
          {
            name: 'handle',
            label: 'Product',
            kind: 'text',
            help: 'The end of its web address',
          },
          { name: 'reason', label: 'Why it is needed', kind: 'text' },
        ],
      },
      {
        name: 'documents',
        label: 'Documents',
        kind: 'items',
        help: 'Spec sheets, fitting guides and certificates',
        fields: [
          { name: 'title', label: 'Title', kind: 'text' },
          {
            name: 'url',
            label: 'Link',
            kind: 'text',
            help: 'Starts with https:// or /, like /downloads/fitting-guide.pdf',
          },
        ],
      },
      { name: 'features', label: 'Key features', kind: 'list', help: 'One per line' },
      { name: 'warranty', label: 'Warranty', kind: 'text', help: 'Like: 25-year guarantee' },
    ],
    schema: z.object({
      product: slug,
      completeTheJob: z
        .array(z.object({ handle: slug, reason: required('reason it is needed') }))
        .default([])
        .refine(
          (items) => new Set(items.map((item) => item.handle)).size === items.length,
          'Each product appears once in "complete the job"',
        ),
      documents: z
        .array(
          z.object({
            title: required('document title'),
            url: z
              .string()
              .trim()
              .regex(/^(https:\/\/|\/)\S+$/, 'Document links start with https:// or /'),
          }),
        )
        .default([]),
      features: list,
      warranty: optionalText,
    }),
  },
  {
    type: 'range-page',
    label: 'Range and category pages',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'name', label: 'Name', kind: 'text' },
      slugField,
      { name: 'kind', label: 'Kind', kind: 'select', options: ['range', 'category'] },
      { name: 'h1', label: 'Main heading', kind: 'text' },
      { name: 'intro', label: 'Introduction', kind: 'textarea' },
      {
        name: 'scope',
        label: 'Which products it lists',
        kind: 'group',
        help: 'A range page must list products: give categories, words in the name, or both',
        fields: [
          {
            name: 'categories',
            label: 'Categories',
            kind: 'list',
            help: 'Category names, one per line',
          },
          { name: 'titleIncludes', label: 'Words in the product name', kind: 'list' },
        ],
      },
      {
        name: 'buyingGuide',
        label: 'Buying guide',
        kind: 'textarea',
        help: 'Leave a blank line between paragraphs',
      },
      faqsField,
      {
        name: 'curated',
        label: 'Filtered pages with their own address',
        kind: 'items',
        fields: [
          { name: 'name', label: 'Name', kind: 'text' },
          slugField,
          { name: 'h1', label: 'Main heading', kind: 'text' },
          { name: 'intro', label: 'Introduction', kind: 'textarea' },
          {
            name: 'filters',
            label: 'Filters',
            kind: 'items',
            fields: [
              { name: 'facet', label: 'Filter', kind: 'text', help: 'Like colour or size' },
              { name: 'value', label: 'Value', kind: 'text' },
            ],
          },
          seoField,
        ],
      },
      seoField,
    ],
    schema: z
      .object({
        name: required('name'),
        slug,
        kind: z.enum(['range', 'category'], { error: 'Choose range or category' }),
        h1: required('main heading'),
        intro: required('introduction'),
        scope: z.object({ categories: list, titleIncludes: list }),
        buyingGuide: optionalText,
        faqs: z.array(faqItem).default([]),
        curated: z
          .array(
            z.object({
              name: required('name'),
              slug,
              h1: required('main heading'),
              intro: required('introduction'),
              filters: z
                .array(z.object({ facet: required('filter'), value: required('value') }))
                .min(1, 'A filtered page needs at least one filter'),
              seo,
            }),
          )
          .default([]),
        seo,
      })
      .refine(
        (page) => page.scope.categories.length > 0 || page.scope.titleIncludes.length > 0,
        'A range page needs products: give categories or words in the product name',
      ),
  },
  {
    type: 'guide',
    label: 'Guides',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text' },
      slugField,
      { name: 'topic', label: 'Topic', kind: 'select', options: GUIDE_TOPICS },
      {
        name: 'answer',
        label: 'Short answer',
        kind: 'textarea',
        help: 'One or two sentences that answer the question',
      },
      { name: 'steps', label: 'Steps', kind: 'list', help: 'One step per line' },
      {
        name: 'body',
        label: 'Body',
        kind: 'textarea',
        help: 'Leave a blank line between paragraphs',
      },
      {
        name: 'products',
        label: 'Products used',
        kind: 'list',
        help: 'Product web addresses, one per line',
      },
      {
        name: 'mainPage',
        label: 'Main page for the topic',
        kind: 'text',
        help: 'Like /porcelain-paving/',
      },
      faqsField,
      {
        name: 'author',
        label: 'Author',
        kind: 'group',
        fields: [
          { name: 'name', label: 'Name', kind: 'text' },
          { name: 'role', label: 'Role', kind: 'text' },
        ],
      },
      { name: 'publishedOn', label: 'First published', kind: 'date' },
      { name: 'reviewedOn', label: 'Checked by the technical team on', kind: 'date' },
      { name: 'placeholder', label: 'Placeholder copy', kind: 'boolean' },
      seoField,
    ],
    schema: z.object({
      title: required('title').max(80),
      slug,
      topic: z.enum(GUIDE_TOPICS, { error: 'Choose a topic' }),
      answer: required('short answer').max(300),
      steps: list,
      body: optionalText,
      products: list,
      mainPage: optionalText,
      faqs: z.array(faqItem).default([]),
      author: z.object({ name: required('author'), role: optionalText }),
      publishedOn: z.iso.date({ error: 'Add the date it was first published' }),
      reviewedOn: z.iso.date().nullish(),
      placeholder: z.boolean().default(false),
      seo,
    }),
  },
  {
    type: 'faq',
    label: 'Questions and answers',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'topic', label: 'Help topic', kind: 'select', options: FAQ_TOPICS },
      { name: 'question', label: 'Question', kind: 'text' },
      slugField,
      { name: 'answer', label: 'Answer', kind: 'textarea' },
    ],
    schema: z.object({
      topic: z.enum(FAQ_TOPICS, { error: 'Choose a help topic' }),
      question: required('question'),
      slug,
      answer: required('answer'),
    }),
  },
  {
    type: 'inspiration',
    label: 'Inspiration photos',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text' },
      slugField,
      { name: 'photo', label: 'Photo', kind: 'image' },
      { name: 'town', label: 'Town', kind: 'text' },
      { name: 'style', label: 'Style', kind: 'text' },
      { name: 'space', label: 'Space', kind: 'text' },
      { name: 'colours', label: 'Colours', kind: 'list' },
      {
        name: 'products',
        label: 'Products in the photo',
        kind: 'list',
        help: 'Product web addresses',
      },
      { name: 'permission', label: 'The customer agreed we can use this photo', kind: 'boolean' },
    ],
    schema: z.object({
      title: required('title'),
      slug,
      photo: image.refine(
        (photo) => photo.alt.length > 0,
        'Describe the photo for people who cannot see it',
      ),
      town: optionalText,
      style: optionalText,
      space: optionalText,
      colours: list,
      products: list,
      permission: z.literal(true, { error: 'Only publish photos the customer agreed we can use' }),
    }),
  },
  {
    type: 'navigation',
    label: 'Navigation',
    singleton: true,
    keyField: null,
    locked: false,
    fields: [
      {
        name: 'header',
        label: 'Links at the top of every page',
        kind: 'items',
        fields: linkFields,
      },
      { name: 'footer', label: 'Links in the footer', kind: 'items', fields: linkFields },
    ],
    schema: z.object({
      header: z.array(link).max(8, 'Keep the top links to eight'),
      footer: z.array(link).default([]),
    }),
  },
  {
    type: 'site-settings',
    label: 'Site settings',
    singleton: true,
    keyField: null,
    locked: false,
    fields: [
      { name: 'contactPhone', label: 'Customer service phone', kind: 'text' },
      { name: 'contactEmail', label: 'Customer service email', kind: 'text' },
      { name: 'openingHours', label: 'Opening hours', kind: 'text' },
      {
        name: 'socialProfiles',
        label: 'Social profiles',
        kind: 'list',
        help: 'Full https:// addresses',
      },
    ],
    schema: z.object({
      contactPhone: required('phone number'),
      contactEmail: z.email('Add an email like hello@talasey.co.uk'),
      openingHours: optionalText,
      socialProfiles: z.array(z.url({ protocol: /^https$/ })).default([]),
    }),
  },
  {
    type: 'redirect',
    label: 'Redirects',
    singleton: false,
    keyField: 'from',
    locked: false,
    fields: [
      { name: 'from', label: 'Old path', kind: 'text', help: 'Like /porcelain-tiles.html' },
      { name: 'to', label: 'Goes to', kind: 'text' },
      { name: 'permanent', label: 'Permanent (301)', kind: 'boolean' },
    ],
    schema: z
      .object({ from: z.string(), to: z.string(), permanent: z.boolean().default(true) })
      .superRefine((redirect, ctx) => {
        const result = redirectCheck(redirect);
        if (result !== true) ctx.addIssue({ code: 'custom', message: result });
      }),
  },
  {
    type: 'email',
    label: 'Email wording',
    singleton: false,
    keyField: 'email',
    locked: false,
    fields: [
      { name: 'email', label: 'Which email', kind: 'select', options: EMAILS },
      { name: 'subject', label: 'Subject', kind: 'text' },
      {
        name: 'body',
        label: 'Message',
        kind: 'textarea',
        help: '{name} is filled in, and {orderNumber} and {deliveryDay} for orders, or {requestNumber} and {samples} for samples, or {product} and {link} for back in stock',
      },
    ],
    schema: z.object({
      email: z.enum(EMAILS, { error: 'Choose which email' }),
      subject: required('subject').max(120),
      body: required('message'),
    }),
  },
  wording('legal', 'Legal wording'),
  wording('finance', 'Finance wording'),
];

export const contentType = (type: string) => CONTENT_TYPES.find((entry) => entry.type === type);

// The key a document is found by: its slug, path or email name, or the type for singletons.
export function keyOf(definition: ContentType, data: Record<string, unknown>): string {
  if (!definition.keyField) return definition.type;
  const value = data[definition.keyField];
  return typeof value === 'string' ? value.trim() : '';
}

export function problemsOf(definition: ContentType, data: unknown): string[] {
  const result = definition.schema.safeParse(data);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => issue.message))];
}
