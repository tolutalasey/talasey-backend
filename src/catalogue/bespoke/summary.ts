import type { BespokeConfig, BespokeSelection } from './pricing.js';

const ORDER = ['W', 'D', 'H', 'L'];
const BOX = 'DHW';

// How a made-to-measure item reads on the basket, order emails and admin, like
// "1200 × 400 × 500 mm, Powder coated, drainage". "No" answers are left out and "Yes" answers
// read as the choice's name.
export function describeBespoke(config: BespokeConfig, selection: BespokeSelection): string {
  const keys = Object.keys(config.dimensions).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const box = [...keys].sort().join('') === BOX;
  const sizes = box
    ? `${keys.map((key) => selection.dimensions[key]).join(' × ')} ${config.unit}`
    : keys
        .map(
          (key) =>
            `${config.dimensions[key as keyof typeof config.dimensions]?.label} ${selection.dimensions[key]}`,
        )
        .join(', ') + ` ${config.unit}`;
  const choices = config.choices.flatMap((choice) => {
    const answer = selection.choices[choice.name];
    if (!answer || answer === 'No') return [];
    return [answer === 'Yes' ? choice.label.toLowerCase() : answer];
  });
  return [sizes, ...choices].join(', ');
}
