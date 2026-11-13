title: '0021 The design system is React Aria, CSS Modules and Storybook',
};

# 0021 The design system is React Aria, CSS Modules and Storybook

**Status:** Accepted, 13 November 2026

## Context

PRD section 18 lists 23 components, and section 12 asks for WCAG 2.2 AA with AAA body text contrast, 3px focus rings and 44px touch targets, tested on every change. Most of these components are interactive, and getting keyboard and screen reader behaviour right by hand is slow and easy to break.

## Decision

- Components are built on React Aria Components, styled with CSS Modules that only use `@talasey/tokens` variables. Interactive ones are client components; the rest render on the server.
- Each component has Vitest tests (keyboard and axe in jsdom) and Storybook stories for its states.
- `test:stories` builds Storybook and opens every story in Chromium at phone and desktop widths, checking axe with colour contrast, the 3px focus ring on each tab stop, and target sizes. This is where contrast is really tested, since jsdom can't measure it.
- Contrast rules for the palette are data in `@talasey/tokens` and tested on every change.
- Jost and Mulish are self-hosted as two variable files cut to Latin and the weights we use (33 KB together).
- The mega menu uses the disclosure navigation pattern with real top-level links, not an ARIA menu, so it works before JavaScript loads.
- React Aria's toast is still marked unstable. It is only used inside `Toast.tsx`, so it can be swapped in one place.
- Medusa's admin needs React 18 types elsewhere in the repo, so the storefront and UI package pin `react` types to their own copy with `paths`. Without it, pnpm's hoisting decides which copy React Aria's types see.

## Consequences

- Adding a component means a CSS module, tests and stories; the browser checks pick up new stories on their own.
- `test:stories` needs Chromium and takes about 6 minutes for 79 stories at two widths.
- The brand colours still need confirming against the brand guidelines; a change only needs the tokens and passes or fails on the contrast tests.
