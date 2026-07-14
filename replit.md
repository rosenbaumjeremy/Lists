# Progress Tracker

A static, no-build-step website for tracking each kid's weekly task with a bit
of gamification. Started from the "Personal Website Starter" template and
built out as a family progress tracker.

## Stack
- Plain HTML/CSS/JS — no framework, no build step, nothing to install.
- `index.html` — page structure.
- `style.css` — styling.
- `app.js` — tracker logic (state, points/streaks, confetti celebration).
- Data is stored per-browser in `localStorage` (key `progressTracker.v1`) — it
  is not shared across devices and resets if browser storage is cleared.

## How to run
- The `Start application` workflow runs `python3 -m http.server 5000` and
  serves the folder — click Run / use the webview to preview.
- No environment variables or secrets are required.
- The real, public site is meant to be hosted on GitHub Pages (per the
  original template) — push changes there to update the live version.

## Current tracker setup
- Boys: Shai (Math homework), Calev (Laining), Aharon (Daily Perek), Itai (Daily Perek).
- Each day of the week has a radio-button pair (done / not yet). Marking a
  day "done" awards points and a small confetti celebration; completing all
  7 days in a week adds a streak point and a bigger celebration.
- "Reset this week" clears the current week's check-offs (banked points and
  streaks are preserved).
- To change names/tasks, edit the `BOYS` array at the top of `app.js`.

## User preferences
(none recorded yet)
