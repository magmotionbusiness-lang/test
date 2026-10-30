# Habit Hub

A habit tracker that feels like a native iOS app. Habits live in **Sections** (Gym, Study, Mindset…), every habit has a **tile calendar** that fills in as you go, and an **AI coach** (Gemini) reviews your days, weeks and months.

It's a Progressive Web App: open the link in Safari and add it to your Home Screen. All data stays on your device (IndexedDB); there are no accounts.

## Install on iPhone or iPad

1. Open the app's link in **Safari**.
2. Tap the **Share** button (iPhone: bottom toolbar; iPad: top right).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Launch Habit Hub from your Home Screen. It opens full-screen and works offline.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**. They are only read by the serverless function in `api/` and never reach the browser.

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | For AI features | — | Google AI Studio API key |
| `GEMINI_MODEL` | No | `gemini-flash-lite-latest` | Gemini model id |

See `.env.example`. Gemini's free tier isn't available to EU users, so enable billing on the key and set a budget alert in Google AI Studio.

## Deploy

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, import this repository. Vercel detects Vite; no settings need changing.
3. Add the environment variables above.
4. Every push to `main` deploys automatically.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
npm run icons      # re-render icons and iOS splash screens (needs Playwright)
```

Code layout:

- `src/domain/` — pure logic: dates, schedules, streaks, scores, aggregation. Unit-tested.
- `src/db/` — Dexie schema (`db.ts`), the data access layer screens use (`repo.ts`), and demo data.
- `src/components/` — reusable iOS-style UI (pages, lists, sheets, toggles, rings).
- `src/screens/` — one file per screen.
- `src/ai/prompts.ts` — all AI prompt templates.
- `api/` — Vercel serverless functions (the Gemini proxy).

To see every screen with realistic data: **Settings → Load demo data**.
