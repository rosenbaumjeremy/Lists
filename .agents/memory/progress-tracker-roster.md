---
name: Progress Tracker roster editing
description: How the tracked-people roster (name/task/color/emoji) is stored and edited vs. per-person progress history.
---

The roster (who's tracked, their name/task/color/emoji) is stored under a separate localStorage key from the weekly check-in/points/streak history. A settings modal lets a parent add/remove/edit roster entries without touching code.

**Why:** Keeping roster and progress history in separate keys means editing/removing a person doesn't require migrating or destroying their historical points/streak data, and a code-level default roster can still seed first-time use.

**How to apply:** When adding features that touch "who is tracked" (e.g. reordering, archiving), read/write the roster key and leave the progress-history key's shape alone unless a migration is explicitly needed.
