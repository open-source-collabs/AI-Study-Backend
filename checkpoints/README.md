# checkpoints/

Reserved for study-session resume and checkpoint data.

**Purpose is not finalized, and no checkpoint logic belongs here yet.** This file exists so the
folder's intent is on record without committing the folder to a design that no phase has approved
yet.

Note that this folder sits at the project root rather than under `src/`, because its contents are
expected to be data artifacts rather than application code.

## What this folder is for

A study session can be long and interruptible. Checkpoints capture enough state to let a user
close the app mid-session and resume where they left off — position in the material, progress
through summaries, flashcards or quizzes, and answers already committed.

## What is not decided

- Whether checkpoints are durable database rows (preferred, and the assumption until proven
  otherwise) or files on disk. Durable state belongs in the database per the architecture
  conventions, so this folder is likely to end up holding exports, fixtures or development
  scratch data instead.
- Retention and cleanup policy, including whether a session's checkpoints expire once the session
  is completed.
- Whether a checkpoint is a full snapshot or a delta against the last one.
- Whether an incomplete AI generation is resumable or simply retried.

Until those questions are answered and the owning phase has picked up the work, this folder stays
empty. See [../docs/architecture.md](../docs/architecture.md) for the conventions any
implementation must follow, and the Roadmap in [../README.md](../README.md) for which phase owns
it — study sessions and progress tracking are currently planned for a later phase.
