title: '0029 Fallback content is marked as placeholder and kept out of search',
};

# 0029 Fallback content is marked as placeholder and kept out of search

**Status:** Accepted, 13 November 2026

## Context

There is no Sanity project yet, but brand, project, guide and help pages need content to build and test the templates. Copy written by a developer hasn't been checked by the content team, and some of it (brand stories, test data, cost bands) only Talasey can write.

## Decision

- Every content loader falls back to local content when Sanity isn't set up or has nothing yet, as the homepage already did.
- Fallback brand, project and guide pages carry `placeholder: true`. A placeholder page is `noindex, follow`, stays out of the sitemaps and llms.txt, and only says what we know from the product data and the PRD.
- Sections with no content (story, figures, guarantees, downloads, photos) are left out rather than filled in.

## Consequences

- Every template can be built, tested and demonstrated before the content exists, and nothing unchecked can rank.
- Pages go live in search the moment the content team publishes them in Sanity.
- Until then, the brand pages can't rank for the brand names, which the PRD asks for.
