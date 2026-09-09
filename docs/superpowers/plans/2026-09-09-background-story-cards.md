# Background Story Cards Implementation Plan

> Execute task by task with verification. The user has approved the design including centered overlapping cards at the bottom edge.

**Goal:** Keep exploration responsive while validated story passages arrive in floating cards.

**Architecture:** A session-persisted serial request queue drives existing story APIs. Product actions use the same deterministic reducer as the server for immediate UI state; verified narrative snapshots remain separate. AIStoryRail becomes a centered card stack.

**Tech Stack:** React, Zustand, Framer Motion, existing Pages Functions, Node tests.

- [x] Add failing tests for ordering, retained failed jobs, retry, reset cancellation and restored jobs in `src/services/background-story.test.mjs`.
- [x] Implement queue in `src/services/background-story.js`; wire `ai.js`, store and App initialization. Reuse shared action rules, reconcile acknowledged actions on retry, preserve session IDs.
- [x] Update M3 immediate introduction and remove inline AI stories; ensure M4/M6 consume immediate action results without later responses resetting gameplay.
- [x] Replace AIStoryRail JSX/CSS with centered incoming cards and overlapping bottom-edge archive, with keyboard/reduced-motion support.
- [x] Run queue and existing backend regression tests, build, verify browser interactions and responsive layout, review diff.
- [ ] Commit and deploy approved changes; verify deployment response and report limitations honestly.

