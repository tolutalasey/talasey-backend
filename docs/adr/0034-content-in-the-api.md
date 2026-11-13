# 0034 Content and publishing in the API

**Status:** Accepted, 13 November 2026. Supersedes 0003 and 0022.

## Context

Content lived in Sanity, a hosted service with its own studio, roles and pricing. Editors needed drafts, a contributor/editor split, validation before publishing, preview, and the audit trail we have for products.

## Decision

Content is stored by the API as documents of a type (homepage, brand, project and range pages, guides, FAQs, inspiration, navigation, site settings, redirects, email wording, legal and finance wording). Each type is defined once, in `content-types.ts`: the fields, which draw the form in `/content`, and the rules checked before publishing.

Every document has a draft and a published copy. Contributors save drafts; editors publish; only the owner publishes legal and finance wording. Every change is in the audit log and can be restored. The site reads only published copies, and falls back to its built-in copy for anything not published yet.

## Consequences

- No CMS subscription and one sign-in for staff.
- Adding a field is a code change, reviewed like any other.
- Rich text is plain paragraphs separated by blank lines for now; a rich text field can be added as a new field kind.
