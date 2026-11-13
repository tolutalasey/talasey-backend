import { bespokeConfigSchema } from './pricing.js';

const choices = [
  {
    label: 'Finish',
    name: 'FIN',
    answers: [
      { label: 'Mild steel', value: 1 },
      { label: 'Corten', value: 2 },
      { label: 'Powder coated', value: 3 },
    ],
  },
  {
    label: 'Feet',
    name: 'FEET',
    answers: [
      { label: 'No', value: 0 },
      { label: 'Yes', value: 25 },
    ],
  },
  {
    label: 'Castors',
    name: 'CASTORS',
    answers: [
      { label: 'No', value: 0 },
      { label: 'Yes', value: 25 },
    ],
  },
  {
    label: 'Drainage',
    name: 'DRAIN',
    answers: [
      { label: 'No', value: 0 },
      { label: 'Yes', value: 0 },
    ],
  },
];

const shared = `STEEL_RATE = if(FIN>2.5, 1100, if(FIN>1.5, 2320, 1100));
COAT = if(FIN>2.5, 1, 0);`;

const labour = `LABOUR = if(WEIGHT>100, 212.5, if(WEIGHT>50, 125, 62.5));`;

export const sienna = bespokeConfigSchema.parse({
  unit: 'mm',
  formula: `${shared}
AREA_M2 = (W*D + 2*W*H + 2*D*(H+30)) / 1000000;
WEIGHT = AREA_M2 * 3 * 7.85;
STEEL = WEIGHT / 1000 * STEEL_RATE * 1.1;
COATING = AREA_M2 * 15 * COAT;
WELD = ((W*2 + D*2) + H*4) / 1000 * 2.6;
${labour}
COST = STEEL + COATING + WELD + LABOUR + FEET + CASTORS + DRAIN + 13 + 3.5 + 59;
COST / 0.65 * 1.2`,
  dimensions: {
    W: { label: 'Width', min: 400, max: 2400, step: 1 },
    H: { label: 'Height', min: 300, max: 1000, step: 1 },
    D: { label: 'Depth', min: 300, max: 2400, step: 1 },
  },
  choices,
});

export const linea = bespokeConfigSchema.parse({
  unit: 'mm',
  formula: `${shared}
A1 = W*D + ((W*H - D) + W*H) + 2*(D*(H+30));
A2 = (L-D)*D + 2*(L*H) + D*(H+30);
AREA_M2 = (A1 + A2) / 1000000;
WEIGHT = AREA_M2 * 3 * 7.85;
STEEL = WEIGHT / 1000 * STEEL_RATE * 1.1;
COATING = AREA_M2 * 15 * COAT;
WELD = ((W + L + (D*2) + (W-D) + (L-D)) + (H*6)) / 1000 * 2.6;
${labour}
DELIV = if(WEIGHT>85, ((WEIGHT-85)*0.49)+44, if(WEIGHT>35, 44, 32)) + 15;
COST = (STEEL + COATING + WELD + LABOUR + FEET + CASTORS + DRAIN + 13 + 3.5 + DELIV) * 1.15;
COST / 0.65 * 1.2`,
  dimensions: {
    W: { label: 'Length 1', min: 600, max: 2400, step: 1 },
    D: { label: 'Width', min: 300, max: 1000, step: 1 },
    H: { label: 'Height', min: 300, max: 1000, step: 1 },
    L: { label: 'Length 2', min: 600, max: 2400, step: 1 },
  },
  choices,
});
