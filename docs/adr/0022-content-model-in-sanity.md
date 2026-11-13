# 0022 The content model and its rules live in the Studio schema

**Status:** Accepted, 13 November 2026

## Context

PRD sections 13, 17 and 19 set rules for content: search title and description lengths, URL format, alt text on every image, range pages that always sell something, approved legal and finance wording, and a review every 12 months for guides. Editors need to hear about a problem when they make it, not after launch. We have no Sanity project yet, so all of this has to be testable on a laptop.

## Decision

- Pages are built from a fixed library of sections (hero, product grid, banner, comparison, questions, video, reviews, guide links, launch list, legal and finance wording). The storefront renders each section with a design system component.
- Product facts stay in Medusa ([0006](/adr/0006-content-and-commerce-data)); `productContent` holds the words and media and matches by product handle.
- Each rule is a plain function in `apps/studio/schemas/rules.ts`, used by the schema. Unit tests cover the functions, and a second set runs Sanity's own validator over the compiled schema, the way the Studio does on publish, with a stand-in for the API.
- Image alt text is checked on the `alt` field, not on the image, so a field that adds `required` doesn't switch it off (a field's own rules replace its type's).
- Contributors draft and editors publish; legal and finance wording is read-only and unpublishable for anyone but administrators. The Studio hides the actions, and the dataset roles in Sanity must match.

## Consequences

- Editors see each rule as a plain message in the Studio and can't publish until it's fixed.
- The rules can change without a Sanity account, and the tests show what an editor would see.
- When the Sanity project is created, its roles need setting to match (contributor, editor, administrator).
- Sanity's command-line validator reports document-wide rules as warnings rather than errors; the Studio treats them as errors.
