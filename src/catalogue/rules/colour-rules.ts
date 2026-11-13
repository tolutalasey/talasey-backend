export interface ColourChoice {
  id: string;
  name: string;
  hex: string;
  photo_url: string | null;
}

export interface ColourRule {
  option: string | null;
  value: string | null;
  required: boolean;
  colours: ColourChoice[];
}

export interface ColourOffer {
  required: boolean;
  colours: ColourChoice[];
}

// A colour set applies when the rule's option has its value, for example "show when Finish is
// Powder coated". A rule with no option applies to every variant.
export function coloursFor(
  rule: ColourRule | null,
  selected: Record<string, string>,
): ColourOffer | null {
  if (!rule || rule.colours.length === 0) return null;
  if (rule.option && selected[rule.option] !== rule.value) return null;
  return { required: rule.required, colours: rule.colours };
}

export interface ChosenColour {
  colour_id?: unknown;
  colour?: unknown;
}

// What is wrong with the colour on a basket line, or null when it is fine: a colour must be
// chosen when the set is required, and it must come from the set offered for those options.
export function colourProblem(
  rule: ColourRule | null,
  options: Record<string, string>,
  chosen: ChosenColour | null | undefined,
  label = 'colour',
): string | null {
  const offer = coloursFor(rule, options);
  const id = typeof chosen?.colour_id === 'string' ? chosen.colour_id : null;
  if (!offer) return id ? `This option doesn't come in a choice of ${label}.` : null;
  if (!id) return offer.required ? `Choose a ${label}.` : null;
  const match = offer.colours.find((colour) => colour.id === id);
  const sameName = chosen?.colour === undefined || chosen.colour === match?.name;
  return match && sameName ? null : `Choose a ${label} from the list.`;
}
