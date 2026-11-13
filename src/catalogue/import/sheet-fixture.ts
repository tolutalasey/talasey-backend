const blank = {
  'Short description': null,
  Description: null,
  'Sale price': null,
  'Weight (kg)': null,
  Categories: null,
  Parent: null,
  'Attribute 1 name': null,
  'Attribute 1 value(s)': null,
  'Attribute 2 name': null,
  'Attribute 2 value(s)': null,
  'Meta: wcpt_template': null,
  'Meta: wcpt_colour_set': null,
};

const variation = (sku: string, size: string, finish: string, price: string | null) => ({
  ...blank,
  Type: 'variation',
  SKU: sku,
  Name: null,
  Published: '1',
  'Regular price': price,
  Parent: 'P-SCREEN-ABSTRACT',
  'Attribute 1 name': 'Size',
  'Attribute 1 value(s)': size,
  'Attribute 2 name': 'Finish',
  'Attribute 2 value(s)': finish,
});

export const productRows = [
  {
    ...blank,
    Type: 'variable',
    SKU: 'P-SCREEN-ABSTRACT',
    Name: 'Abstract Branches Decorative Screen',
    Published: '1',
    'Regular price': null,
    'Short description': 'Decorative laser-cut garden screen.',
    Categories: 'Architectural Steelwork > Screens',
    'Attribute 1 name': 'Size',
    'Attribute 1 value(s)': '1800 × 300 mm, 1800 × 600 mm',
    'Attribute 2 name': 'Finish',
    'Attribute 2 value(s)': 'Weathered Steel, Powder Coated',
    'Meta: wcpt_template': 'one',
    'Meta: wcpt_colour_set': 'standard_powder_coat_colours',
    'Meta: wcpt_colour_when': 'Finish',
    'Meta: wcpt_colour_values': 'Powder Coated',
  },
  variation('SCRAB1800-300C', '1800 × 300 mm', 'Weathered Steel', '79.99'),
  variation('SCRAB1800-600C', '1800 × 600 mm', 'Weathered Steel', '119.99'),
  variation('SCRAB1800-600PC', '1800 × 600 mm', 'Powder Coated', null),
  {
    ...blank,
    Type: 'simple',
    SKU: 'EDWOWO250',
    Name: 'Woven Steel Connector Bracket - 250mm',
    Published: '0',
    'Regular price': null,
    Categories: 'Architectural Steelwork > Garden Edging',
    'Meta: wcpt_template': 'one',
  },
  {
    ...blank,
    Type: 'simple',
    SKU: 'PTEDINST',
    Name: 'Brushed Stainless Steel Inlay Strip - 20x3x4000mm (1no.)',
    Published: '1',
    'Regular price': '64.50',
    'Weight (kg)': '2.4',
    Categories: 'Architectural Steelwork > Garden Edging',
    'Meta: wcpt_template': 'one',
  },
];

export const heldBackRows = [
  {
    'Product name (product enrichment sheet)': 'Origin Pergola 3m x 3m',
    SKU: 'PERORFS33',
    Range: 'Pergolas',
    "Why it isn't in the Products tab":
      "Hidden: pergolas go on the build-your-own (template 4) page, which isn't built yet.",
  },
  {
    'Product name (product enrichment sheet)': 'Bronze hare sculpture',
    SKU: null,
    Range: 'Sculptures',
    "Why it isn't in the Products tab":
      'No SKU. Every product needs a unique SKU before it can be imported.',
  },
];
