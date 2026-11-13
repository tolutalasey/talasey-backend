# 0041 A JavaScript budget we can keep

**Status:** Accepted, 13 November 2026. Changes the 90 KB figure in PRD §11.

## Context

PRD §11 set 90 KB of compressed JavaScript per page. React 19 and the Next.js router alone are about 120 KB, before any of our code, so no page built on them can meet 90 KB. On 13 November every page of the shop loaded about 260 KB, the same on every page, because:

- the `src/ui` index file made any page using one component download all of them, including the React Aria library (about 70 KB);
- the consent dialog pulled in the analytics event schemas and their validation library (about 30 KB);
- the consent dialog was drawn by JavaScript after the page loaded, so on a first visit it became the largest thing painted, late.

## Decision

- No `src/ui` index: each component is imported from its own file, and lint refuses `@/ui`.
- The consent dialog is plain HTML in every page, shown by CSS when a small script in the head finds no current choice, and uses the browser's own form controls instead of React Aria. The consent code imports only the consent rules, not the analytics schemas.
- The shop's CSS (about 7 KB compressed) is inlined in the page.
- Budgets, checked by the end-to-end tests (`e2e/tests/budget.spec.ts`):

| Pages                              | Budget | Today          |
| ---------------------------------- | ------ | -------------- |
| Home, ranges, guides, help, search | 150 KB | 144 KB         |
| Product, basket                    | 190 KB | 183 KB, 181 KB |
| Contact                            | 200 KB | 196 KB         |

## Consequences

- Content pages now carry about 24 KB on top of React and Next.js, down from about 140 KB.
- Pages with forms still load React Aria for their fields and buttons (about 40 KB). Replacing those with plain form elements is the next saving if a page misses its speed target.
- Lighthouse in CI still fails a page under 90; the PRD's 95 stays the target on real phones, measured once the site is on its own hosting.
