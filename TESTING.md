# Test checklist (iPhone or iPad)

Follow in order. Each line says where to tap and what you should see.

## 1. Install
1. Open the Vercel link in **Safari** → an "Install Habit Hub" panel slides up with three steps.
2. Tap **Share → Add to Home Screen → Add**, then open **Habit Hub** from the Home Screen → it opens full-screen with a launch screen; the tab bar sits above the home indicator.
3. Rotate your iPad (or turn on Dark Mode in iOS) → the layout and colours adapt.

## 2. Onboarding (fresh install)
4. Welcome screen → tiles fill in with a spring. Tap **Continue**.
5. Tick **Gym** (keep Mindset and Health) → **Continue**.
6. Tick **Meditate** and **Work out** → **Start tracking** → Home shows both habits.

## 3. Core loop (Home)
7. Tap the circle on **Meditate** → it fills with a check and the row bounces; the ring at the top shows 1/2.
8. Tap **Work out**'s circle → 2/2: "All done for today ✨" with confetti, once. Reopen the app → it doesn't repeat.
9. Swipe **Meditate** right → nothing changes (already done). Tap its circle again → it clears.
10. Swipe **Meditate** left → **Skip** → toast "your streak is safe" → tap **Undo** → restored.
11. Swipe left → **More** → **Add note** → type something → **Save**.
12. Tap **Thursday** (or any past day) in the date strip → the title changes to that weekday → log it → tap today again.
13. Tap **+** (top right) → create a **Count** habit "Water", target 8, unit "glasses" → tap its circle three times → "3 / 8 glasses" and a partial ring. Hold the circle → choose **8 glasses** → done.
14. After 5 pm (or once all habits are done) → **Daily check-in** card: pick a mood, energy and type a line.

## 4. Load demo data
15. **Settings → Load demo data → OK** → 6 months of history appears.

## 5. Tile calendar
16. **Home → tap "Meditate"'s name** → the habit page opens, sliding in from the right; the year grid opens scrolled to today.
17. Tap a past tile → the amount panel opens (it's a time habit). For a check habit like **Spanish practice**, a tap toggles the tile with a pop.
18. Hold a tile → the day sheet: Mark done / Minimum / Skip / Clear, note, and **🧊 Use a streak freeze** on missed days.
19. Switch **Year → Month** → a big calendar with day numbers; use the arrows to change month.
20. Scroll down → streaks, consistency (30d / 90d / All), history list. Tap a history row to edit it.
21. Tap the **share icon** (top right) → a progress card image → **Share image** → the iOS share sheet.
22. Drag from the **left edge** of the screen → back to Home.

## 6. Sections and analytics
23. **Sections** → cards with a 12-week mini grid and this week's %. Tap **Edit** → drag the grips to reorder → **Done**.
24. Tap **Study** → section grid, week-over-week, habit rows with mini grids, then **Analytics**: tap the line chart → tooltip; the weekday bars show best and worst.
25. Back → **Gym** → scroll to **Gym**: volume per week, personal records, recent workouts.
26. In Gym, open **Strength training** → hold a tile → **Workout** → add an exercise and sets → **Save**.

## 7. AI (needs `GEMINI_API_KEY` in Vercel)
27. **Insights → Week → Generate review** → skeleton cards, then: headline with score, Strong, Needs care, Patterns, Goals, Next steps.
28. Switch to **Month** and back to **Week** → the same review appears instantly, marked "cached".
29. **Settings → What gets sent** → the exact JSON that was sent; turn **Include my notes** on and reopen → notes appear.
30. **Goals → +** → "Run a 10k", pick a deadline → **Plan it with AI** → answer the questions with chips → **Make my plan** → **Add** / **Skip** habits (max 3 new) → **Create**.
31. On the goal page → **Am I on track?** → a check-in with one suggested adjustment. Tick a milestone; use **+/−** to update progress.
32. **Sections → Study → Review this section with AI** → Insights opens filtered to Study.
33. Turn on **Airplane Mode** → **Insights → Today** shows "You're offline" (cached reviews still open); the rest of the app keeps working. Turn it off.

## 7b. Vision board
- **Goals** → the glowing **Vision Board** card at the top (polaroids float, a shimmer passes) → tap it → six tilted polaroids on a warm board.
- Tap **Wealth** → the polaroid lifts off, straightens and glides to the middle; the room dims. Tap the pencil → **Choose a photo** → pick a wide photo → drag it in the frame to choose what shows → write a few words → **Save**.
- Close (✕, or pull the photo down) → it flies back to exactly its spot. Reopen → the photo develops from a pale haze to full colour.
- Tap the dots under the photo → progression fills in; the board's "of the way" bar moves.
- **Break it down** → a headline, a "Start today" step, 3–5 actions with how often, and milestones. **Make it a goal** → the goal form opens with the name, your words and those milestones filled in → **Add** → the button becomes "Goal · 0%".
- **+** → a new tile; close without changes → it disappears again. Edit → **Delete tile** removes it.
- **Export backup** → **Erase all data** → **Import backup** → the board comes back with its photos.

## 8. Settings and data
34. **Theme → Dark / Light / System**; **First day of the week → Sunday** → grids re-align.
35. **Accent color** → pick green → buttons and links turn green.
36. **Export backup** → share sheet → **Save to Files**.
37. **Erase all data** → confirm twice → empty app → **Import backup** → pick the file → everything returns.
38. iOS **Settings → Accessibility → Display & Text Size → Larger Text** → reopen Habit Hub → text is bigger, layout holds.
39. Turn on **VoiceOver** → swipe through Home: every control is read out, e.g. "Meditate: 0 of 10 min".
