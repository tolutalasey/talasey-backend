import { z } from 'zod';
import {
  lengthCheck,
  redirectCheck,
  SEO_DESCRIPTION,
  SEO_TITLE,
  slugCheck,
  type Check,
} from './content-rules.js';
import { ENQUIRY_FORMS } from '../enquiries/inboxes.js';

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
  | { name: string; label: string; kind: 'image' | 'file'; help?: string };

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
const YOUTUBE_ID = /^[\w-]{11}$/;
// The video's ID from any YouTube link (watch, share, embed or shorts), or the ID itself.
const youtubeId = (value: string) => {
  if (YOUTUBE_ID.test(value)) return value;
  const match = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(value);
  return match?.[1] ?? null;
};
const slug = z.string({ error: 'Add a URL slug' }).superRefine(toZod(slugCheck));
const optionalText = z.string().trim().nullish();
// A product's web address as the shop made it. Page address rules (length, dates, codes) are for
// new pages, so they don't apply here.
const productHandle = z
  .string({ error: "Add the product's web address" })
  .trim()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use the end of the product's web address, like solar-light-post-cap",
  );
const list = z.array(z.string().trim().min(1)).default([]);
const seo = z.object({
  title: z.string().superRefine(toZod((value) => lengthCheck(value, SEO_TITLE, 'search title'))),
  description: z
    .string()
    .superRefine(toZod((value) => lengthCheck(value, SEO_DESCRIPTION, 'search description'))),
});
const link = z.object({ label: required('link text'), href: required('link address') });
const metres = z.coerce
  .number({ error: 'Give sizes in metres, like 3' })
  .positive('Give sizes in metres, like 3');
const millimetres = z.coerce
  .number({ error: 'Give sizes in millimetres, like 1873' })
  .int('Give sizes in whole millimetres')
  .positive('Give sizes in millimetres, like 1873');
const optionalCount = z
  .union([z.literal(''), z.coerce.number().int().positive()])
  .nullish()
  .transform((value) => (value === '' ? null : value));

export const SOLD_AS = ['paving', 'decking', 'cladding', 'jointing', 'cleaner', 'single'] as const;

export const PERGOLA_LIGHTING = ['Optional kit for each size', 'Included as standard'] as const;
export const PERGOLA_SIDE_KINDS = ['One piece per side', 'Panels to mix'] as const;
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

// Homepage sections added to match the current site. Left empty, they keep its wording.
const KEEPS = "Leave empty to keep the current site's wording";
const TILE_FIELDS: Field[] = [
  { name: 'photo', label: 'Photo', kind: 'image' },
  { name: 'title', label: 'Title', kind: 'text' },
  { name: 'summary', label: 'Summary', kind: 'textarea' },
  { name: 'href', label: 'Goes to', kind: 'text' },
];
const homeTile = z.object({
  photo: image.nullish(),
  title: required('title'),
  summary: required('summary'),
  href: required('link'),
});

export const DOCUMENT_KINDS = [
  'Installation & Technical Guides',
  'Specification Sheets',
  'Safety Data Sheets',
  'Declaration of Performance',
  'Comparison Charts',
] as const;
export const DOCUMENT_RANGES = [
  'Artificial Grass',
  'Cleaners',
  'Composite Products',
  'Finishing Touches',
  'Installation',
  'Natural Stone',
  'Porcelain',
  'Sealers',
] as const;
const documentRanges = z
  .array(z.enum(DOCUMENT_RANGES, { error: `Use one of: ${DOCUMENT_RANGES.join(', ')}` }))
  .default([]);
// The gallery's sections, as Amy set them out (Website Gallery sheet).
const GALLERY_CATEGORIES = [
  'Low Maintenance Spaces',
  'Traditional Gardens',
  'Contemporary Gardens',
  'Stylish Entryways',
  'Unique Features',
  'Garden Structures',
  'Finishing Touches',
] as const;
const galleryCategories = z
  .array(z.enum(GALLERY_CATEGORIES, { error: `Use one of: ${GALLERY_CATEGORIES.join(', ')}` }))
  .min(1, 'Choose at least one gallery section');
const productsField: Field = {
  name: 'products',
  label: 'Show on these products',
  kind: 'list',
  help: 'Product web addresses, one per line',
};
const documentRangesField: Field = {
  name: 'ranges',
  label: 'Product ranges',
  kind: 'list',
  help: `One per line, from: ${DOCUMENT_RANGES.join(', ')}`,
};

export const ACKNOWLEDGEMENT_RANGES = [
  'Porcelain',
  'Natural stone',
  'Composite',
  'Artificial grass',
] as const;

export const NEWS_CATEGORIES = [
  'Company Updates',
  'Educational',
  'Inspirational',
  'Competitions & Awards',
  'New Appointments',
  'Training',
  'Case Studies',
  'Events',
  'Tips & Advice',
  'Interviews',
  'Product Updates',
] as const;

// Forms a plain page can show under its text, each sent to Enquiries in /admin.
export const PAGE_FORMS = ['partner', 'warranty', 'contact'] as const;

export const GUIDE_TOPICS = ['Planning', 'Buying', 'Laying', 'Care'] as const;
export const FAQ_TOPICS = [
  'Natural stone',
  'Porcelain',
  'Composite',
  'Artificial grass',
  'Laying',
  'Care',
  'Protecting',
  'Delivery',
  'Returns',
  'Finance',
  'Samples',
] as const;
export const FINDER_PRICES = ['lower', 'any', 'higher'] as const;

// An answer that favours products whose name, colours or finishes contain one of its words.
const finderAnswers = (name: string, label: string): Field => ({
  name,
  label,
  kind: 'items',
  fields: [
    { name: 'label', label: 'Answer', kind: 'text' },
    { name: 'hint', label: 'Small print', kind: 'text' },
    {
      name: 'words',
      label: 'Words to look for',
      kind: 'text',
      help: 'Words in product names, colours or finishes, separated by commas. Leave empty for "no preference"',
    },
    { name: 'reason', label: 'Reason shown on results', kind: 'text', help: 'Like Low upkeep' },
  ],
});

const finderAnswerList = z
  .array(
    z.object({
      label: required('answer'),
      hint: optionalText,
      words: optionalText,
      reason: optionalText,
    }),
  )
  .min(2, 'Add at least two answers');

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const EMAILS = [
  'order-confirmation',
  'sample-order-confirmation',
  'delivery-day-booked',
  'enquiry-received',
  'samples-requested',
  'samples-dispatched',
  'back-in-stock',
  'sign-in-link',
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
        name: 'heroScenes',
        label: 'Hero photos',
        kind: 'items',
        help: 'They take turns behind the heading, each with a tab that links to its range',
        fields: [
          { name: 'photo', label: 'Photo', kind: 'image' },
          { name: 'topic', label: 'Small label', kind: 'text' },
          { name: 'title', label: 'Tab title', kind: 'text' },
          { name: 'href', label: 'Goes to', kind: 'text' },
        ],
      },
      { name: 'projectsHeading', label: 'Tiles heading', kind: 'text', help: KEEPS },
      { name: 'projectsIntro', label: 'Tiles introduction', kind: 'textarea', help: KEEPS },
      {
        name: 'projectTiles',
        label: 'Project tiles',
        kind: 'items',
        fields: TILE_FIELDS,
      },
      { name: 'whyHeading', label: 'Why Talasey heading', kind: 'text', help: KEEPS },
      {
        name: 'whyPoints',
        label: 'Why Talasey points',
        kind: 'items',
        help: KEEPS,
        fields: [
          { name: 'title', label: 'Title', kind: 'text' },
          { name: 'text', label: 'Text', kind: 'textarea' },
        ],
      },
      {
        name: 'whyStats',
        label: 'Numbers',
        kind: 'items',
        help: KEEPS,
        fields: [
          { name: 'value', label: 'Number, like 25+', kind: 'text' },
          { name: 'label', label: 'What it counts', kind: 'text' },
        ],
      },
      { name: 'collectionsHeading', label: 'Collections heading', kind: 'text', help: KEEPS },
      {
        name: 'collectionsIntro',
        label: 'Collections introduction',
        kind: 'textarea',
        help: KEEPS,
      },
      {
        name: 'collections',
        label: 'Collections',
        kind: 'items',
        help: KEEPS,
        fields: TILE_FIELDS,
      },
      { name: 'stepsHeading', label: 'Planning steps heading', kind: 'text', help: KEEPS },
      { name: 'stepsIntro', label: 'Planning steps introduction', kind: 'textarea', help: KEEPS },
      {
        name: 'steps',
        label: 'Planning steps',
        kind: 'items',
        help: KEEPS,
        fields: [
          { name: 'title', label: 'Step', kind: 'text' },
          { name: 'links', label: 'Links', kind: 'items', fields: linkFields },
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
        help: 'Product web addresses, one per line. Spaces left are filled with the newest products that have a photo and a price',
      },
      { name: 'newsHeading', label: 'Articles heading', kind: 'text', help: KEEPS },
      { name: 'newsIntro', label: 'Articles introduction', kind: 'textarea', help: KEEPS },
      { name: 'samplesHeading', label: 'Samples heading', kind: 'text', help: KEEPS },
      { name: 'samplesText', label: 'Samples text', kind: 'textarea', help: KEEPS },
      {
        name: 'samplesPoints',
        label: 'Samples ticks',
        kind: 'list',
        help: 'One per line. ' + KEEPS,
      },
      {
        name: 'samplesActions',
        label: 'Samples buttons',
        kind: 'items',
        help: KEEPS,
        fields: linkFields,
      },
      { name: 'closingHeading', label: 'Closing heading', kind: 'text', help: KEEPS },
      { name: 'closingText', label: 'Closing text', kind: 'textarea', help: KEEPS },
      {
        name: 'closingActions',
        label: 'Closing buttons',
        kind: 'items',
        help: KEEPS,
        fields: linkFields,
      },
      seoField,
    ],
    schema: z.object({
      h1: required('main heading'),
      intro: required('introduction'),
      heroActions: z.array(link).length(2, 'Add exactly two buttons'),
      heroScenes: z
        .array(
          z.object({
            photo: image,
            topic: required('small label'),
            title: required('tab title'),
            href: required('link'),
          }),
        )
        .default([]),
      projectsHeading: optionalText,
      projectsIntro: optionalText,
      projectTiles: z.array(homeTile).min(2, 'Add at least two project tiles'),
      whyHeading: optionalText,
      whyPoints: z
        .array(z.object({ title: required('title'), text: required('text') }))
        .max(4, 'Add up to four points')
        .optional(),
      whyStats: z
        .array(z.object({ value: required('number'), label: required('what it counts') }))
        .max(4, 'Add up to four numbers')
        .optional(),
      collectionsHeading: optionalText,
      collectionsIntro: optionalText,
      collections: z.array(homeTile).max(12, 'Add up to 12 collections').optional(),
      stepsHeading: optionalText,
      stepsIntro: optionalText,
      steps: z
        .array(z.object({ title: required('step'), links: z.array(link).default([]) }))
        .max(6, 'Add up to six steps')
        .optional(),
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
      newsHeading: optionalText,
      newsIntro: optionalText,
      samplesHeading: optionalText,
      samplesText: optionalText,
      samplesPoints: z.array(z.string().trim().min(1)).optional(),
      samplesActions: z.array(link).max(2, 'Add up to two buttons').optional(),
      closingHeading: optionalText,
      closingText: optionalText,
      closingActions: z.array(link).max(2, 'Add up to two buttons').optional(),
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
      {
        name: 'soldAs',
        label: 'Sold as',
        kind: 'select',
        options: [...SOLD_AS],
        help: 'Sets the words and the calculator on the product page: paving by the pack, decking and cladding by the board, jointing by the tub, cleaners by the bottle. Leave empty to go by the category',
      },
      {
        name: 'suits',
        label: 'Suits',
        kind: 'list',
        help: 'What it is for, one per line, like Porcelain or Natural stone',
      },
      {
        name: 'description',
        label: 'Description',
        kind: 'textarea',
        help: 'The words under the name. Leave empty to use the product’s own',
      },
      { name: 'features', label: 'Features and benefits', kind: 'list', help: 'One per line' },
      {
        name: 'colours',
        label: 'Colours',
        kind: 'items',
        help: 'For a product sold in several colours: the words on each colour’s own page',
        fields: [
          { name: 'colour', label: 'Colour', kind: 'text', help: 'As it is named on the product' },
          { name: 'description', label: 'Description', kind: 'textarea' },
          {
            name: 'features',
            label: 'Features and benefits',
            kind: 'list',
            help: 'One per line. Leave empty to use the product’s own',
          },
        ],
      },
      { name: 'warranty', label: 'Warranty', kind: 'text', help: 'Like: 25-year guarantee' },
      {
        name: 'installation',
        label: 'Installation',
        kind: 'textarea',
        help: 'How it is laid or fitted. Leave a blank line between steps',
      },
      {
        name: 'care',
        label: 'Care and maintenance',
        kind: 'textarea',
        help: 'Cleaning, sealing and upkeep. Leave a blank line between paragraphs',
      },
      {
        name: 'faqs',
        label: 'Questions and answers',
        kind: 'items',
        help: 'Questions customers ask about this product',
        fields: [
          { name: 'question', label: 'Question', kind: 'text' },
          { name: 'answer', label: 'Answer', kind: 'textarea' },
        ],
      },
    ],
    schema: z.object({
      product: productHandle,
      completeTheJob: z
        .array(z.object({ handle: productHandle, reason: required('reason it is needed') }))
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
      description: optionalText,
      features: list,
      colours: z
        .array(
          z.object({
            colour: required('colour'),
            description: optionalText,
            features: list,
          }),
        )
        .default([]),
      warranty: optionalText,
      installation: optionalText,
      care: optionalText,
      faqs: z.array(faqItem).default([]),
      soldAs: z.enum(SOLD_AS).nullish(),
      suits: list,
    }),
  },
  {
    type: 'pergola-builder',
    label: 'Pergola builders',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      {
        name: 'slug',
        label: 'Web address',
        kind: 'text',
        help: 'The end of its address under /pergolas/, like origin-pergola',
      },
      { name: 'range', label: 'Range', kind: 'text', help: 'Like Origin' },
      { name: 'intro', label: 'Introduction', kind: 'textarea' },
      { name: 'roof', label: 'Roof', kind: 'text', help: 'Like Manual louvres' },
      { name: 'lighting', label: 'Lighting', kind: 'select', options: PERGOLA_LIGHTING },
      {
        name: 'sizes',
        label: 'Sizes',
        kind: 'items',
        help: 'Each size, with the pergola SKU for each way of fixing it',
        fields: [
          { name: 'label', label: 'Size', kind: 'text', help: 'Like 3 × 3 m' },
          { name: 'width', label: 'Front and back (m)', kind: 'text' },
          { name: 'depth', label: 'Left and right (m)', kind: 'text' },
          { name: 'freeStandingSku', label: 'Free-standing SKU', kind: 'text' },
          { name: 'wallMountedSku', label: 'Wall-mounted SKU', kind: 'text' },
          {
            name: 'freeStandingSize',
            label: 'Free-standing exact size',
            kind: 'text',
            help: 'Like 3023 × 3023 mm, 2550 mm high',
          },
          { name: 'wallMountedSize', label: 'Wall-mounted exact size', kind: 'text' },
          {
            name: 'lightingKitSku',
            label: 'LED kit SKU',
            kind: 'text',
            help: 'Only when lighting is an optional kit',
          },
        ],
      },
      {
        name: 'sides',
        label: 'Side options',
        kind: 'items',
        help: 'One option per side. A 6 m side is two 3 m bays. Options whose SKUs are not on the shop are not offered.',
        fields: [
          { name: 'name', label: 'Option', kind: 'text', help: 'Like Manual wind screen' },
          { name: 'kind', label: 'Made of', kind: 'select', options: PERGOLA_SIDE_KINDS },
          {
            name: 'sku3m',
            label: 'SKU for a 3 m side',
            kind: 'text',
            help: 'Horizontal panel for panels',
          },
          {
            name: 'sku4m',
            label: 'SKU for a 4 m side',
            kind: 'text',
            help: 'Horizontal panel for panels',
          },
          { name: 'verticalSku3m', label: 'Vertical panel SKU, 3 m side', kind: 'text' },
          { name: 'verticalSku4m', label: 'Vertical panel SKU, 4 m side', kind: 'text' },
          { name: 'panels3m', label: 'Panels on a 3 m side', kind: 'text' },
          { name: 'panels4m', label: 'Panels on a 4 m side', kind: 'text' },
        ],
      },
      { name: 'heaterSku', label: 'Heater SKU', kind: 'text', help: 'Any number can be added' },
      {
        name: 'messages',
        label: 'Messages in the summary',
        kind: 'list',
        help: 'Power, foundations, delivery and lead times. One per line.',
      },
      {
        name: 'details',
        label: 'Product details',
        kind: 'items',
        fields: [
          { name: 'heading', label: 'Heading', kind: 'text' },
          { name: 'text', label: 'Text', kind: 'textarea' },
        ],
      },
      seoField,
    ],
    schema: z.object({
      slug,
      range: required('range name'),
      intro: required('introduction'),
      roof: required('roof'),
      lighting: z.enum(PERGOLA_LIGHTING, { error: 'Choose how lighting works' }),
      sizes: z
        .array(
          z.object({
            label: required('size'),
            width: metres,
            depth: metres,
            freeStandingSku: required('free-standing SKU'),
            wallMountedSku: required('wall-mounted SKU'),
            freeStandingSize: optionalText,
            wallMountedSize: optionalText,
            lightingKitSku: optionalText,
          }),
        )
        .min(1, 'Add at least one size'),
      sides: z
        .array(
          z.object({
            name: required('side option name'),
            kind: z.enum(PERGOLA_SIDE_KINDS, { error: 'Choose what the side option is made of' }),
            sku3m: optionalText,
            sku4m: optionalText,
            verticalSku3m: optionalText,
            verticalSku4m: optionalText,
            panels3m: optionalCount,
            panels4m: optionalCount,
          }),
        )
        .default([]),
      heaterSku: optionalText,
      messages: list,
      details: z
        .array(z.object({ heading: required('heading'), text: required('text') }))
        .default([]),
      seo,
    }),
  },
  {
    type: 'fence-builder',
    label: 'Fence builders',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      {
        name: 'slug',
        label: 'Web address',
        kind: 'text',
        help: 'The end of its address under /fence-builder/, like composite-fencing',
      },
      { name: 'name', label: 'Name', kind: 'text', help: 'Like Composite fencing' },
      { name: 'intro', label: 'Introduction', kind: 'textarea' },
      {
        name: 'bayWidth',
        label: 'Bay width (mm)',
        kind: 'text',
        help: 'Post centre to post centre, like 1873',
      },
      {
        name: 'boardCounts',
        label: 'Heights offered (boards per bay)',
        kind: 'list',
        help: 'One number per line, like 6, 8, 10 and 11',
      },
      {
        name: 'styles',
        label: 'Fence styles',
        kind: 'items',
        help: 'Each style is a board product; its colours are the colours shoppers choose from',
        fields: [
          { name: 'name', label: 'Style', kind: 'text', help: 'Like Traditional' },
          {
            name: 'boardProduct',
            label: 'Board product',
            kind: 'text',
            help: "The end of the board's web address",
          },
          { name: 'boardHeight', label: 'Board height (mm)', kind: 'text', help: 'Like 158' },
        ],
      },
      {
        name: 'posts',
        label: 'Posts',
        kind: 'items',
        help: 'Ways of fixing the posts. One post at each end and one between each bay',
        fields: [
          { name: 'name', label: 'Fixing', kind: 'text', help: 'Like Concreted in the ground' },
          { name: 'product', label: 'Post product', kind: 'text' },
          {
            name: 'maxHeight',
            label: 'Tallest fence it takes (mm)',
            kind: 'text',
            help: 'Height above the ground, like 1800',
          },
        ],
      },
      {
        name: 'trimProduct',
        label: 'Trim kit product',
        kind: 'text',
        help: 'One per bay. Leave empty when the fence needs none',
      },
      {
        name: 'toppers',
        label: 'Trellis toppers',
        kind: 'items',
        help: 'Optional, one per bay',
        fields: [
          { name: 'name', label: 'Topper', kind: 'text', help: 'Like Diagonal trellis' },
          { name: 'product', label: 'Product', kind: 'text' },
          { name: 'height', label: 'Height (mm)', kind: 'text', help: 'Like 316' },
        ],
      },
      {
        name: 'postExtras',
        label: 'Post extras',
        kind: 'items',
        help: 'Optional, one per post, such as caps and lights',
        fields: [
          { name: 'name', label: 'Extra', kind: 'text', help: 'Like Solar light post caps' },
          { name: 'product', label: 'Product', kind: 'text' },
          {
            name: 'withProduct',
            label: 'Also needs',
            kind: 'text',
            help: 'A product that goes with each one, like a light adapter. Optional',
          },
        ],
      },
      {
        name: 'details',
        label: 'Product details',
        kind: 'items',
        fields: [
          { name: 'heading', label: 'Heading', kind: 'text' },
          { name: 'text', label: 'Text', kind: 'textarea' },
        ],
      },
      seoField,
    ],
    schema: z.object({
      slug,
      name: required('name'),
      intro: required('introduction'),
      bayWidth: millimetres,
      boardCounts: z
        .array(z.coerce.number().int().min(1).max(30))
        .min(1, 'Add at least one height, as a number of boards'),
      styles: z
        .array(
          z.object({
            name: required('style name'),
            boardProduct: productHandle,
            boardHeight: millimetres,
          }),
        )
        .min(1, 'Add at least one fence style'),
      posts: z
        .array(
          z.object({
            name: required('fixing name'),
            product: productHandle,
            maxHeight: millimetres,
          }),
        )
        .min(1, 'Add at least one way of fixing the posts'),
      trimProduct: optionalText,
      toppers: z
        .array(
          z.object({ name: required('topper name'), product: productHandle, height: millimetres }),
        )
        .default([]),
      postExtras: z
        .array(
          z.object({
            name: required('extra name'),
            product: productHandle,
            withProduct: optionalText,
          }),
        )
        .default([]),
      details: z
        .array(z.object({ heading: required('heading'), text: required('text') }))
        .default([]),
      seo,
    }),
  },
  {
    type: 'product-finder',
    label: 'Product finder',
    singleton: true,
    keyField: null,
    locked: false,
    fields: [
      { name: 'heading', label: 'Main heading', kind: 'text' },
      { name: 'intro', label: 'Introduction', kind: 'textarea' },
      {
        name: 'projects',
        label: 'Answers to "What are you planning?"',
        kind: 'items',
        help: 'Each answer shows products from the ranges listed',
        fields: [
          { name: 'label', label: 'Answer', kind: 'text', help: 'Like A new patio or path' },
          { name: 'hint', label: 'Small print', kind: 'text' },
          {
            name: 'ranges',
            label: 'Ranges',
            kind: 'text',
            help: 'Range web addresses separated by commas, like porcelain-paving, natural-stone-paving',
          },
        ],
      },
      finderAnswers('looks', 'Answers to "Which look do you like?"'),
      finderAnswers('colours', 'Answers to "Which colours suit your garden?"'),
      finderAnswers('upkeep', 'Answers to "How much upkeep are you happy with?"'),
      {
        name: 'budgets',
        label: 'Answers to "What sort of budget?"',
        kind: 'items',
        fields: [
          { name: 'label', label: 'Answer', kind: 'text' },
          { name: 'hint', label: 'Small print', kind: 'text' },
          { name: 'price', label: 'Favours', kind: 'select', options: FINDER_PRICES },
          { name: 'reason', label: 'Reason shown on results', kind: 'text' },
        ],
      },
      seoField,
    ],
    schema: z.object({
      heading: required('main heading'),
      intro: required('introduction'),
      projects: z
        .array(
          z.object({
            label: required('answer'),
            hint: optionalText,
            ranges: required('ranges'),
          }),
        )
        .min(2, 'Add at least two answers'),
      looks: finderAnswerList,
      colours: finderAnswerList,
      upkeep: finderAnswerList,
      budgets: z
        .array(
          z.object({
            label: required('answer'),
            hint: optionalText,
            price: z.enum(FINDER_PRICES),
            reason: optionalText,
          }),
        )
        .min(2, 'Add at least two answers'),
      seo,
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
        name: 'description',
        label: 'Description',
        kind: 'textarea',
        help: 'The fuller words under the heading, as on the current site. Leave a blank line between paragraphs',
      },
      {
        name: 'slides',
        label: 'Photos at the top',
        kind: 'items',
        help: 'The photos that slide at the top of the page. Left empty, the current site’s photos are used',
        fields: [{ name: 'photo', label: 'Photo', kind: 'image' }],
      },
      {
        name: 'closing',
        label: 'Bespoke note',
        kind: 'textarea',
        help: 'Shown above the message form at the bottom, like the offer to make it to order',
      },
      {
        name: 'photo',
        label: 'Photo at the top',
        kind: 'image',
        help: 'A wide garden photo, at least 2000 pixels across. Left empty, a brochure photo is used.',
      },
      {
        name: 'gallery',
        label: 'Photo gallery',
        kind: 'items',
        help: 'Shown on the page while it has no products to list, and below the products once it does',
        fields: [
          { name: 'photo', label: 'Photo', kind: 'image' },
          {
            name: 'caption',
            label: 'Caption',
            kind: 'text',
            help: 'Like Corten steel stag sculptures',
          },
        ],
      },
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
        name: 'video',
        label: 'Video',
        kind: 'text',
        help: 'A YouTube link, shown under the introduction',
      },
      {
        name: 'sections',
        label: 'Ranges this page introduces',
        kind: 'list',
        help: 'Web addresses of other ranges, one per line, like composite-fencing. Each shows as a card through to its page',
      },
      {
        name: 'alsoNeed',
        label: 'You may also need',
        kind: 'list',
        help: 'Web addresses of other ranges, one per line, like paving-jointing. Their products show on this range\'s product pages',
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
        description: optionalText,
        slides: z.array(z.object({ photo: image })).default([]),
        closing: optionalText,
        photo: image.nullish(),
        gallery: z.array(z.object({ photo: image, caption: optionalText })).default([]),
        scope: z.object({ categories: list, titleIncludes: list }),
        video: optionalText,
        sections: list,
        alsoNeed: list,
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
    type: 'page',
    label: 'Pages',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text', help: 'The heading at the top of the page' },
      {
        name: 'slug',
        label: 'Web address',
        kind: 'text',
        help: "The page lives at /this-address/, like about-talasey. Keep the current site's address so links still work",
      },
      {
        name: 'intro',
        label: 'Introduction',
        kind: 'textarea',
        help: 'Optional. One or two sentences',
      },
      { name: 'photo', label: 'Photo at the top', kind: 'image', help: 'Optional' },
      {
        name: 'body',
        label: 'Text',
        kind: 'textarea',
        help: 'Leave a blank line between paragraphs. Start a line with ## for a heading or - for a bullet point. Add a link like [Contact us](/contact/)',
      },
      {
        name: 'faqs',
        label: 'Questions and answers',
        kind: 'items',
        help: 'Optional. Shown under the text, each opening with a drop-down',
        fields: [
          { name: 'question', label: 'Question', kind: 'text' },
          { name: 'answer', label: 'Answer', kind: 'textarea' },
        ],
      },
      {
        name: 'form',
        label: 'Form',
        kind: 'select',
        options: PAGE_FORMS,
        help: 'Optional. partner: Partner Programme application. warranty: warranty registration. contact: a message to the team',
      },
      {
        name: 'actions',
        label: 'Buttons at the end',
        kind: 'items',
        help: 'Optional, like Contact us or Download the brochure',
        fields: linkFields,
      },
      {
        name: 'placeholder',
        label: 'Placeholder copy',
        kind: 'boolean',
        help: 'Tick while the text is a stand-in; the page stays out of search engines',
      },
      seoField,
    ],
    schema: z.object({
      title: required('title').max(100),
      slug,
      intro: optionalText,
      photo: image.nullish(),
      body: required('text'),
      faqs: z.array(faqItem).default([]),
      form: z.enum(PAGE_FORMS).nullish(),
      actions: z.array(link).max(3, 'Keep it to three buttons').default([]),
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
      {
        name: 'categories',
        label: 'Gallery sections',
        kind: 'list',
        help: `One per line, from: ${GALLERY_CATEGORIES.join(', ')}`,
      },
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
      categories: galleryCategories,
      colours: list,
      products: list,
      permission: z.literal(true, { error: 'Only publish photos the customer agreed we can use' }),
    }),
  },
  {
    type: 'hub-document',
    label: 'Knowledge Hub documents',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text' },
      slugField,
      { name: 'kind', label: 'Document type', kind: 'select', options: DOCUMENT_KINDS },
      { name: 'file', label: 'PDF', kind: 'file' },
      { name: 'thumbnail', label: 'Cover picture', kind: 'image' },
      documentRangesField,
      productsField,
      { name: 'publishedOn', label: 'Date', kind: 'date' },
    ],
    schema: z.object({
      title: required('title'),
      slug,
      kind: z.enum(DOCUMENT_KINDS, { error: 'Choose a document type' }),
      file: required('PDF'),
      thumbnail: image.nullish(),
      ranges: documentRanges,
      products: z.array(productHandle).default([]),
      publishedOn: z.iso.date({ error: 'Add the date' }),
    }),
  },
  {
    type: 'video',
    label: 'Videos',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text' },
      slugField,
      {
        name: 'youtube',
        label: 'YouTube link',
        kind: 'text',
        help: 'Paste the address of the video on YouTube',
      },
      { name: 'summary', label: 'Summary', kind: 'textarea' },
      documentRangesField,
      productsField,
      { name: 'publishedOn', label: 'Date', kind: 'date' },
    ],
    schema: z.object({
      title: required('title'),
      slug,
      youtube: z
        .string({ error: 'Paste the YouTube link' })
        .trim()
        .transform((value) => youtubeId(value) ?? '')
        .refine(Boolean, 'Paste a YouTube link, like https://www.youtube.com/watch?v=yL5G2vCriY8'),
      summary: optionalText,
      ranges: documentRanges,
      products: z.array(productHandle).default([]),
      publishedOn: z.iso.date({ error: 'Add the date' }),
    }),
  },
  {
    type: 'brochure',
    label: 'Brochures',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text' },
      slugField,
      { name: 'edition', label: 'Edition number (sets the order)', kind: 'text' },
      { name: 'summary', label: 'Summary', kind: 'textarea' },
      {
        name: 'link',
        label: 'Link to read it',
        kind: 'text',
        help: 'The Flipsnack address, or leave empty to show "Coming soon"',
      },
      { name: 'cover', label: 'Cover', kind: 'image' },
    ],
    schema: z.object({
      title: required('title'),
      slug,
      edition: z.coerce.number({ error: 'Give the edition as a number' }).int().positive(),
      summary: required('summary'),
      link: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || /^https:\/\//.test(value),
          'Use a link starting https://',
        )
        .nullish(),
      cover: image.nullish(),
    }),
  },
  {
    type: 'acknowledgement',
    label: 'Brochure acknowledgements',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'company', label: 'Company', kind: 'text' },
      slugField,
      { name: 'about', label: 'What they do', kind: 'text' },
      { name: 'product', label: 'Product in the photo', kind: 'text' },
      { name: 'range', label: 'Product range', kind: 'select', options: ACKNOWLEDGEMENT_RANGES },
      { name: 'page', label: 'Brochure page', kind: 'text' },
      {
        name: 'photos',
        label: 'Photos',
        kind: 'items',
        fields: [{ name: 'photo', label: 'Photo', kind: 'image' }],
      },
    ],
    schema: z.object({
      company: required('company name'),
      slug,
      about: optionalText,
      product: required('product'),
      range: z.enum(ACKNOWLEDGEMENT_RANGES, { error: 'Choose a product range' }),
      page: optionalCount,
      photos: z.array(z.object({ photo: image })).default([]),
    }),
  },
  {
    type: 'news-post',
    label: 'News & blogs',
    singleton: false,
    keyField: 'slug',
    locked: false,
    fields: [
      { name: 'title', label: 'Title', kind: 'text' },
      slugField,
      { name: 'publishedOn', label: 'Date', kind: 'date' },
      {
        name: 'categories',
        label: 'Categories',
        kind: 'list',
        help: `One per line, from: ${NEWS_CATEGORIES.join(', ')}`,
      },
      {
        name: 'excerpt',
        label: 'Summary',
        kind: 'textarea',
        help: 'Shown on the news list and in search results',
      },
      {
        name: 'body',
        label: 'Article',
        kind: 'textarea',
        help: 'A blank line between paragraphs, "## " for a heading, "- " for a bullet, [text](address) for a link and ![description](https://…) on its own line for a picture',
      },
      { name: 'photo', label: 'Main photo', kind: 'image' },
    ],
    schema: z.object({
      title: required('title'),
      slug,
      publishedOn: z.iso.date({ error: 'Add the date' }),
      categories: z
        .array(z.enum(NEWS_CATEGORIES, { error: `Use one of: ${NEWS_CATEGORIES.join(', ')}` }))
        .default([]),
      excerpt: optionalText,
      body: required('article'),
      photo: image.nullish(),
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
        name: 'menu',
        label: 'Main menu',
        kind: 'items',
        help: 'Each item opens a menu of sections. Leave its sections empty to make it a plain link',
        fields: [
          { name: 'label', label: 'Menu name', kind: 'text', help: 'Like Landscaping Materials' },
          {
            name: 'href',
            label: 'Goes to',
            kind: 'text',
            help: 'Only for a plain link, like /custom-made/',
          },
          {
            name: 'sections',
            label: 'Sections',
            kind: 'items',
            fields: [
              { name: 'label', label: 'Section name', kind: 'text', help: 'Like Paving' },
              { name: 'href', label: 'Goes to', kind: 'text', help: 'Like /porcelain-paving/' },
              {
                name: 'photo',
                label: 'Photo',
                kind: 'image',
                help: 'Shown beside the menu. Left empty, the range photo is used',
              },
              {
                name: 'links',
                label: 'Links under this section',
                kind: 'items',
                fields: linkFields,
              },
            ],
          },
        ],
      },
      {
        name: 'header',
        label: 'Links at the very top',
        kind: 'items',
        help: 'Like Brochures, News, About us and Contact us',
        fields: linkFields,
      },
      {
        name: 'footer',
        label: 'Footer columns',
        kind: 'items',
        fields: [
          { name: 'heading', label: 'Column heading', kind: 'text', help: 'Like Help & Advice' },
          { name: 'links', label: 'Links', kind: 'items', fields: linkFields },
        ],
      },
    ],
    schema: z.object({
      menu: z
        .array(
          z.object({
            label: required('menu name'),
            href: optionalText,
            sections: z
              .array(
                z.object({
                  label: required('section name'),
                  href: optionalText,
                  photo: image.nullish(),
                  links: z.array(link).default([]),
                }),
              )
              .default([]),
          }),
        )
        .min(1, 'Add at least one menu')
        .max(9, 'Keep the main menu to nine items')
        .superRefine((menu, ctx) =>
          menu.forEach((item, index) => {
            if (!item.href && item.sections.length === 0)
              ctx.addIssue({
                code: 'custom',
                path: [index, 'href'],
                message: `Give "${item.label}" an address or at least one section`,
              });
          }),
        ),
      header: z.array(link).max(8, 'Keep the top links to eight').default([]),
      footer: z
        .array(z.object({ heading: required('column heading'), links: z.array(link).min(1) }))
        .default([]),
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
        name: 'address',
        label: 'Head office address',
        kind: 'textarea',
        help: 'Shown in the footer. One line per line of the address',
      },
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
      address: optionalText,
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
  {
    type: 'enquiry-inbox',
    label: 'Where enquiries go',
    singleton: false,
    keyField: 'form',
    locked: false,
    fields: [
      { name: 'form', label: 'Form', kind: 'select', options: ENQUIRY_FORMS },
      {
        name: 'email',
        label: 'Send to',
        kind: 'text',
        help: 'One email address. Forms not listed here go to sales@talasey.co.uk',
      },
    ],
    schema: z.object({
      form: z.enum(ENQUIRY_FORMS, { error: 'Choose which form' }),
      email: z.email('Add an email like sales@talasey.co.uk'),
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
