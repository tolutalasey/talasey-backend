# 0030 Contact enquiries go through an EnquiryStore port

**Status:** Accepted, 13 November 2026

## Context

PRD section 6 asks for a contact form with photo upload. The CRM and the email service aren't chosen yet, and nothing may leave the laptop during the build.

## Decision

- The contact form is a server action. It accepts up to five photos of 5 MB each (JPEG, PNG, WebP or HEIC) and works without JavaScript.
- Enquiries are saved through an `EnquiryStore` interface. The local adapter writes each one to its own folder under `.data/enquiries` (or `ENQUIRY_DIR`), with the photos renamed `photo-1.jpg` and so on; names sent by the browser are never used as paths.
- The server action and proxy body limits are raised to 26 MB for the photos.

## Consequences

- Locally, enquiries can be read straight from the folder.
- Production needs a CRM or email adapter before launch: Vercel's file system doesn't keep files.
- There is no spam protection yet; it should come with the production adapter.
