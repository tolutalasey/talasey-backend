# 0036 Staff accounts, roles and the audit log in the API

**Status:** Accepted, 13 November 2026. Supersedes 0005.

## Context

Staff edited products in the Medusa admin and content in Sanity, each with its own accounts and roles, and our catalogue log only covered our Medusa module.

## Decision

The API has its own staff accounts with four roles: owner (everything, including accounts), catalogue (products, orders, delivery), editor (content, publishing) and contributor (content drafts). Passwords are hashed with scrypt; sessions are random tokens kept in Redis (only their hash is stored) and sent as a bearer token by the web app, which keeps it in an httpOnly cookie. Five wrong passwords lock an email for 15 minutes.

Every change to products, colour sets, delivery zones, content and staff accounts writes its whole state before and after to one audit log. Restoring an entry writes the earlier state back and logs that too.

## Consequences

- One place to see who changed what, and to undo it.
- Single sign-on (Microsoft or Google) can be added later behind the same session.
