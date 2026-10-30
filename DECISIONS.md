# Decisions

Judgment calls made while building, newest at the bottom of each phase.

## Phase 1 — Foundation

- **Pinned, battle-tested dependency versions** (React 18.3, Vite 5.4, Framer Motion 11, Dexie 4.0, date-fns 3, Tailwind 3.4, TypeScript 5.6) instead of the newest majors. Stability and well-known APIs matter more than novelty for an app nobody can debug from a laptop.
- **Swipe-left actions** will show *Skip* plus *More* (which opens Minimum version, Note, Edit) rather than four buttons; four don't fit comfortably on an iPhone row.
- **Recharts is lazy-loaded** only on analytics screens so Home stays fast; tile grids are hand-built SVG.
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
