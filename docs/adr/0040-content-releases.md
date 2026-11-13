# 0040 Content releases

**Status:** Accepted, 13 November 2026.

## Context

PRD §23 asks for sign-off built in, scheduled publishing, and grouped releases: several changes (a sale's pages, banners and wording) prepared together and put live at the same moment.

## Decision

A release is a named list of content documents. Publishing it publishes the current draft of each one inside a single database transaction, so either everything goes live or nothing does, and the release records why. A release can be scheduled for a time; a scheduler in the API checks every 30 seconds, takes a lock in Redis so only one instance acts, and publishes as the person who scheduled it, with that person's permissions at that moment.

Any change to a scheduled release (adding or taking out a document) puts it back to unscheduled, so what goes live is what someone looked at when they scheduled it. A document can wait in one release at a time.

## Consequences

- Scheduling a single page is a release with one document in it; there is one way to schedule, not two.
- Releases cover content only. Price changes on a schedule (for sales) are planned with promotions in the buying phase.
- Times are entered and shown in UK time and stored in UTC.
