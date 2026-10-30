# Habit Hub

A habit tracker that feels like a native iOS app. Habits live in **Sections** (Gym, Study, Mindset…), every habit has a **tile calendar** that fills in as you go, and a calm **AI coach** (Google Gemini) reviews your days, weeks and months and turns goals into small habits.

It's a Progressive Web App: open the link in Safari and add it to your Home Screen. All data stays on your device (IndexedDB); there are no accounts.

## Features

- **Home** — today's habits grouped by Morning / Afternoon / Evening / Anytime with one-tap check-off, swipe right to complete, swipe left to Skip or More (minimum version, exact amount, note, edit). A 21-day date strip for logging past days, a 26-week overview grid, this week vs last, best streaks, goals at risk, streak-freeze offers, an end-of-day check-in and a one-time celebration when everything's done.
- **Five habit types** (check, count, duration, number, avoid) and **four schedules** (daily, specific weekdays, X per week, X per month), each with a minimum version, cue and "why".
- **Tile calendar** — a GitHub-style year grid and a month view for every habit; tap a past day to log it, hold it for notes, workouts and streak freezes.
- **Sections** — per-section grids, consistency over time, best and worst weekdays, longest streaks, and gym extras (weekly volume, personal records, workout history).
- **Goals** — the AI Goal Planner asks a few questions and proposes up to 3 new habits (reusing ones you already have); goal pages show milestones, linked habits and an "Am I on track?" check-in.
- **Insights** — AI reviews of today, this week, this month or a custom range, optionally for one section, cached so the same review never costs twice.
- **Fair streaks** — planned skips never break a streak, and 2 streak freezes a month cover unplanned misses.
- **Private by default** — only summaries go to the AI, notes only if you opt in, and Settings shows exactly what gets sent. Export and import JSON backups.
- **Native feel** — iOS type scale with Dynamic Type, light and dark themes, springy transitions, back-swipe, bottom sheets, offline support and WCAG AA contrast.

## Install on iPhone or iPad

1. Open the app's link in **Safari**.
2. Tap the **Share** button (iPhone: bottom toolbar; iPad: top right).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open Habit Hub from your Home Screen. It runs full-screen and works offline.

Install before you start tracking: iOS keeps the Home Screen app's data separate from Safari's.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. Only the serverless function in `api/` reads them; they never reach the browser.

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | For AI features | — | Google AI Studio API key |
| `GEMINI_MODEL` | No | `gemini-flash-lite-latest` | Gemini model id |

See `.env.example`. Gemini's free tier isn't available to EU users, so enable billing on the key and set a budget alert in Google AI Studio. Usage is tiny: each review is one request of a few KB, and the app caps each device at 20 requests a day by default.

## Deploy

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, import this repository. Vercel detects Vite; no settings need changing.
3. Add the environment variables above, then redeploy (or push any commit).
4. Every push to `main` deploys automatically.

## Development

```bash
npm install
npm run dev        # local dev server (AI calls need `vercel dev` to run the function)
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
npm run format     # Prettier
npm run icons      # re-render icons and iOS splash screens (needs Playwright)
```

Code layout:

- `src/domain/` — pure logic: dates, schedules, streaks, freezes, consistency, analytics, goal pace and AI payloads. Unit-tested.
- `src/db/` — Dexie schema (`db.ts`), the data access layer screens use (`repo.ts`), demo data and backups.
- `src/ai/` — prompt templates (`prompts.ts`), request/response schemas (`schemas.ts`) and the client with limits and caching.
- `api/ai.ts` — the Vercel serverless function that calls Gemini. Prompts are built here from structured data; the key never reaches the browser.
- `src/components/` — reusable iOS-style UI (pages, lists, sheets, tile grid, charts, rows).
- `src/screens/` — one file per screen.

See `DECISIONS.md` for every judgment call and `TESTING.md` for a tap-by-tap test checklist.

To see every screen with realistic data, tap **Explore with demo data** on the welcome screen, or **Settings → Load demo data**.
