# Decisions

Judgment calls made while building, newest at the bottom of each phase.

## Phase 1 — Foundation

- **Pinned, battle-tested dependency versions** (React 18.3, Vite 5.4, Framer Motion 11, Dexie 4.0, date-fns 3, Tailwind 3.4, TypeScript 5.6) instead of the newest majors. Stability and well-known APIs matter more than novelty for an app nobody can debug from a laptop.
- **Swipe-left actions** will show *Skip* plus *More* (which opens Minimum version, Note, Edit) rather than four buttons; four don't fit comfortably on an iPhone row.
- ~~Recharts is lazy-loaded~~ → superseded in Phase 4: all charts are hand-built SVG (see below).
- **Persistent storage**: the app calls `navigator.storage.persist()` at startup to reduce the chance iOS evicts IndexedDB, on top of the 30-day backup reminder.
- **Default AI model** `gemini-flash-lite-latest` (an alias Google keeps current), overridable via `GEMINI_MODEL`.
- **Entry statuses**: added `minimum` alongside done/partial/skipped/missed, so "minimum version" days can be drawn distinctly in the tile grid and still count as completed for streaks.
- **Sections have a `kind`** (`standard` | `gym`) so "this is a Gym section" is explicit rather than inferred from its name.
- **"Missed" is implicit**: a scheduled past day with no entry is a miss. Entries are only written when something happened, which keeps the database small for 5+ years of data.
- **Flexible schedules** (X per week/month) appear on Home every day until the period's quota is met, then disappear for the rest of the period.
- **Theme is applied before first paint** from a small `localStorage` mirror, avoiding a white flash in dark mode; IndexedDB stays the source of truth.
- **Splash screens** are generated for 21 iPhone/iPad sizes in light and dark (60 images). They're not precached by the service worker; iOS fetches them only at install time.
- **Erase all data** uses two native confirm dialogs for the double confirmation; they look and feel native on iOS.
- **Install guide** opens automatically once on first launch in iOS Safari (not when already installed), and is always reachable from Settings → About.

## Phase 2 — Core loop

- **One tap per type**: check/avoid toggle; count adds +1 (and resets once the target is reached); duration/numeric open the amount sheet when empty or partial, and a tap on a completed one clears it. Hold a count control for an exact number.
- **Swipe right** completes with the full target; **swipe left** reveals *Skip* and *More* (minimum version, exact amount, note, edit, clear day). Every logging action from a swipe or menu shows a toast with **Undo**.
- **Streak rules**: skipped days and frozen misses are neutral; minimum-version days count; partial days break a streak; an unfinished today never breaks it. Flexible habits (X per week/month) count streaks in weeks or months that met their quota. Home shows streaks computed over the last 400 days to keep each render cheap; the habit page uses full history.
- **Retroactive logging**: a 21-day date strip on Home, with a tiny completion bar under each day. The title switches to the weekday when you're not on today.
- **Reordering** is behind an *Edit* / *Reorder* button with grip handles, like iOS, so dragging never fights scrolling.
- **Back swipe**: standalone web apps on iOS don't get Safari's edge swipe, so pushed screens can be dragged back from the left edge.
- **Delete vs archive**: archiving keeps history and is undoable; deleting asks for confirmation and removes history.
- **Swipe actions are hidden from VoiceOver while closed**; every action is also reachable from the habit page. A dedicated VoiceOver pass comes in Phase 6.
- **Notes on days with no result** are stored on an entry with status `missed`, so the grid still shows the day as empty.

## Phase 3 — Tile calendar

- **One `<TileGrid>`** (single SVG, tiles grouped and memoised by month, coordinate hit-testing instead of per-tile listeners). Measured with 5 years × 12 habits of data: habit page ready in ~0.2 s, a toggle re-renders in ~0.15 s, horizontal scroll at 60 fps.
- **Month view** is an HTML grid of real buttons rather than SVG, so VoiceOver reads each day ("Friday 16 October: done").
- **Tile states never rely on colour alone**: skipped has a diagonal stroke, minimum a centre dot, missed an outline, today a ring; a legend sits under the calendar.
- **Flexible habits** (X per week/month) have no required days, so their empty days are drawn as quiet "not scheduled" tiles rather than misses.
- **Tap a past tile**: check/avoid toggle; quantity habits open the amount sheet. **Hold** opens the day sheet (status, amount, note, workout, streak freeze). Using a sheet instead of a floating popover keeps it reachable with one thumb and works with VoiceOver.
- **Grids start at least 26 weeks back** even for brand-new habits, so the calendar never looks empty or cramped.
- **Consistency** = earned ÷ expected. Done and minimum earn 1, partial earns its share; skipped and frozen days are removed from "expected"; today only counts once logged; for flexible habits the period in progress can only raise the score.
- **Streak freezes** (2 per calendar month, shared across habits) cover a past day with no result, from the day sheet. Built now because the day sheet is where they belong; surfaced on Home in Phase 4.
- **Workouts** are logged per day on gym-section habits (exercises, sets of reps × kg); logging one marks a check habit done.
- **Share card** pulled forward from Phase 6 since the habit page is where it lives: a 1080×1350 PNG drawn on a canvas, shared via the Web Share API (files), with a download fallback.

## Phase 4 — Analytics

- **No chart library.** The charts are single-series lines and bars; hand-built SVG (2px lines, 4px rounded bar tops, recessive grid, tap/hover tooltip, a visually hidden data table for VoiceOver) avoids ~100 KB of Recharts and matches the iOS look exactly. Single-series charts take the section's colour and need no legend; the title names the series.
- **Pooled metrics for sections and Home**: Σ earned ÷ Σ expected across habits, so a habit with 7 scheduled days weighs more than one with 2.
- **Global grid intensity** = share of that day's *due* habits completed (skips excluded; flexible habits count until their quota is met — the same rule as the Today list), drawn in 5 steps.
- **Best and worst weekdays** use the last 90 days; only the best and worst bars carry a value label.
- **"Goals at risk"**: a goal is behind when its linked habits ran below 70% over the last 14 days, or measurable progress trails elapsed time by more than 15 points, or it's past its deadline.
- **Freeze offer on Home**: when yesterday was a scheduled, unlogged day that ended a streak of 3+, Home offers a freeze (while any are left). "Not now" is remembered per device for that day.
- **Gym extras** appear on sections marked *Gym*: weekly volume (Σ sets × reps × kg), personal records by heaviest set with an Epley 1RM estimate, and recent workouts.
- **Prettier** added (`npm run format`) so formatting stays consistent.

## Phase 5 — AI

- **Prompts are built on the server** (`api/ai.ts` imports `src/ai/prompts.ts`); the browser sends only a task name and structured data. Nobody can use the deployed endpoint as a free general-purpose Gemini proxy.
- **One schema file** (`src/ai/schemas.ts`, Zod) is shared by the client and the function: requests are validated on the server, replies are validated on both sides. On an invalid reply the server retries once with a repair prompt; the client then shows a calm error card with Retry. (Observed in testing: one plan reply came back malformed and the retry fixed it.)
- **Guardrails**: 30 KB body cap (checked on both sides), 25 s Gemini timeout (40 s client), JSON response mode, `maxOutputTokens` 4096, per-device daily limit (default 20, Settings) counted only for requests that reach the server, plus a best-effort per-IP cap of 100/day on the server.
- **Caching**: every result is stored in `aiReviews` keyed by a SHA-256 of task + payload. Opening the same review again shows the cached one with its timestamp; *Refresh* re-asks. Logging something changes the payload, so a new review is generated only when there's something new to say.
- **Privacy**: payloads contain aggregates (counts, percentages, streaks, best/worst weekday) and names of habits, sections and goals. Note text is sent only with *Include my notes* on. *Settings → What gets sent* shows the exact JSON for a real "This week" review.
- **Review period comparison**: every review compares with the immediately preceding period of the same length (e.g. Mon–Fri vs the 5 days before).
- **Section reviews** reuse the review task with a section filter ("Review this section with AI" opens Insights pre-filtered).
- **Goal Planner**: goal → up to 3 clarifying questions (chips + free text) → plan. Reused habits are validated against real ids; at most 3 *new* habits can be accepted. New sections are created by name when the plan suggests one that doesn't exist.
- **Goal pace and check-ins**: goal progress is current ÷ target (or milestones done); "Am I on track?" sends the goal plus linked habits' 14/30-day consistency and returns one adjustment.
- **Default model**: `gemini-flash-lite-latest` (verified working; replies in 1–4 s in testing).

## Phase 6 — Polish

- **Onboarding** is three screens (what it is → pick sections from 5 presets → tick starter habits, or "Start from a goal with AI", which opens the planner). It only shows on a true first run (no settings and no habits), so returning users never see it flash. An "Explore with demo data" link skips straight to a full app.
- **Install first**: in iOS Safari the install guide opens over onboarding, with a note that the Home Screen app keeps its data separate from Safari.
- **Daily check-in** (mood, energy, one line) appears on Home after 5 pm or once everything is done, and on any past day you open from the date strip. It saves as you tap.
- **Celebration** fires once per day when every habit due today is done: a soft glow and short confetti (glow only with Reduce Motion). Rows bounce gently when completed.
- **Backup reminder** on Home every 30 days (from your first habit, or last export), snoozable for 7 days. Backups are JSON files shared via the iOS share sheet (Save to Files); import validates the file and replaces the device's data after confirmation.
- **Dynamic Type**: iOS reports the preferred text size through `-apple-system-body`; the app measures it and scales typography through `--type-scale` (capped at 150%) while spacing stays on the 8-pt grid.
- **Contrast**: Apple's default secondary grey and system blue fall slightly below WCAG AA. Secondary text uses 74% instead of 60% opacity in light mode, and the accent is split into a text colour and a fill colour, each tuned at runtime to 4.5:1 for whichever accent the user picks. Numbers and labels always use text colours; habit colours stay on tiles, rings, dots and icons. axe reports no WCAG A/AA violations on any main screen in light or dark mode.
- **Tap targets**: segmented controls and toggles extend their hit areas to 44 pt with invisible padding, keeping the iOS visual size.
- **Tab bar** is a navigation list with `aria-current`, not ARIA tabs, since tabs change pages.
- **Code splitting**: Home ships in the main bundle; every other screen, the validation library and the backup code load on first use. Lighthouse (mobile): Performance 95–96, Accessibility 100, Best Practices 100. Lighthouse 12 no longer has a PWA category; installability comes from the manifest (192/512 + maskable icons, standalone display) and the service worker.
- **Share cards** were built in Phase 3, and export/import and the accent colour in Phase 5, next to the screens that use them.
- **"App icon accent color"**: iOS doesn't let web apps change their Home Screen icon after install, so this setting changes the in-app accent (buttons, links, selection) instead.
- **Reminders** (`reminderTime`) are stored but not delivered: iOS web push needs a push server, which conflicts with "no cloud backend" in v1.

## After launch — feedback round 1

- **Tab switches animate**: a short spring slide plus fade toward the tapped tab (left or right by tab order). Pushes and pops keep the full iOS slide.
- **Insights is the centre tab** and the app's data hub, shown as a larger raised button in the middle of the tab bar. It shows everything for the chosen period: consistency vs the period before, done/partial/skipped/missed totals, a day-by-day chart, sections and habits ranked with changes, streaks, mood and energy, weekdays and the 26-week grid. The AI coach sits below and reads the same numbers.
- **Insights periods are rolling** (Today, 7 days, 30 days, Custom), not calendar week and month, so they never come up empty on a Monday or the 1st.

## After launch — feedback round 2

- **Home Screen widget**: not possible for a web app on iOS (widgets need a native App Store app). The closest equivalent is the **app icon badge** (iOS 16.4+, installed web apps): Settings → "Habits left on app icon" shows today's open habits as a badge. iOS requires notification permission for badges; no notifications are sent. Web apps can only update it while open, so it refreshes on every change and when the app returns to the foreground.
- **Done buttons**: section habit rows get a clear Done button for today, and the habit page has a full-width Done button at the top. Check/avoid toggle, count adds one, time/number habits open the amount sheet until the target is met. Home check circles grew from 34 to 40 pt (48 pt hit area).
- **Grids fit their space**: tile grids measure their container and show as many whole weeks as fit, with tiles sized to fill the width exactly (no half-cut columns or empty space). Only the habit page's full-history calendar still scrolls. Month labels near the right edge are right-aligned so they aren't clipped.
- **Motion everywhere**: rows glide when a finished habit sinks to the bottom; switching days, Insights periods, Year/Month and months cross-fades with a slide in the direction of travel; the check-in card expands in; chart bars grow and lines draw in; progress bars glide; the Done button morphs between states. All of it respects Reduce Motion.
- **Rolling 7 days** replaces "this week" on Home, the section page and section cards, matching Insights.
- **Bug fix**: the confirmation helper introduced for the preview build called itself, so confirmed actions (delete, erase, load demo over existing data, import) crashed instead of asking. Fixed, with a unit test.

## After launch — feedback round 3

- **Completion sound**: plays once when every habit due today is done, alongside the celebration. A synthesised chime is the default, so the app ships no audio files. Users can pick their own sound (any audio file or a screen recording) in Settings; the app decodes it, trims silence, caps it at 8 s and stores a small WAV on the device. Copyrighted sounds stay on the user's device and never go into the repository or the public deployment.
- **Audio on iOS** uses Web Audio, unlocked on the first tap, because the sound fires from a data update rather than directly from a tap. With the ringer switch on silent, iOS may mute it.
- **Schema v2** adds a `blobs` store for user files. Purely additive, with a migration test that v1 data survives. Backups don't include the sound; importing a backup keeps it.
