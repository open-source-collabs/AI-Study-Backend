# src/scrapers/

Reserved for fetching study material from external sources.

**Purpose is not finalized, and no scraping logic belongs here yet.** This file exists so the
folder's intent is on record without committing the folder to a design that no phase has approved
yet.

## What this folder is for

The study workflow needs a way to bring in material a user did not upload themselves — a public
URL, a documentation site, a feed. Anything that retrieves and normalises that content on the
application's behalf belongs in this folder.

## What this folder is not for

- Not the place for HTTP clients used by a single feature. A helper used by one caller stays next
  to that caller; see `src/utils/` for the shared-helper rule.
- Not the place for parsing or summarising fetched content. Retrieval stops at raw, stored
  content; interpretation is the AI integration layer's job, behind one provider-agnostic
  interface.
- Not a place for scheduled or recurring fetches. Periodic work belongs behind the event layer,
  not inside a scraper.

## Open questions

These are deliberately unresolved, and each is expected to be answered by the phase that first
needs a scraper:

- Which sources are supported first, and is the set user-configurable or fixed?
- Is fetching in-process, or delegated to a background worker for long or large jobs?
- What is the rate-limiting and politeness policy per host?
- How is a failed or partial fetch surfaced — a domain `AppError`, a job status, or both?
- How are robots directives, paywalls and auth-gated pages handled?

Until those questions are answered and the owning phase has picked up the work, this folder stays
empty. See [../../docs/architecture.md](../../docs/architecture.md) for the conventions any
implementation must follow, and the Roadmap in [../../README.md](../../README.md) for which phase
owns it.
