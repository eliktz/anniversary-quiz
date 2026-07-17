# Anniversary Quiz — Design Spec (2026-07-18)

## Purpose
A one-night build: a beautiful, Hebrew (RTL), Kahoot-style family quiz for Elik & his wife's
13th wedding anniversary, played together with their son Yonatan on a single iPad in the
morning. 13 questions (one per year of marriage), each followed by an answer reveal and a
~1-minute cinematic photo slideshow. Deployed to GitHub Pages.

## Approved decisions (user-confirmed)
| Decision | Choice |
|---|---|
| Language | Hebrew, full RTL layout |
| Gameplay | Casual together — no scores, no timer pressure; tap answer → reveal → slideshow |
| Visual style | Warm & romantic: deep plum/rose/gold gradients, elegant type, hearts/confetti on reveal |
| Slideshow | Ken Burns (slow zoom/pan), no captions, tap-to-skip, ~1 min per question |
| Photos | User-provided raw photos at `~/Desktop/quiz-raw-photos/` (topic folders), auto-assigned to questions by content analysis |
| Music | Royalty-free sourced tracks (question loop, reveal stingers, slideshow ballad). If user drops personal mp3s (e.g. "Piangi con me" — Bee Bee Sea) into the folder, weave them in (finale/slideshow) |
| Deployment | GitHub Pages, public repo (user explicitly accepted photos being public) |
| Device target | iPad Safari primarily; works in any modern browser |

## Content
13 questions extracted from the user's Google Doc (verbatim Hebrew, correct answer was
marked `*`). Stored in `data/questions.js`. Question numbering matches photo assignment.

Photo inventory (~80 JPGs): `army` (3, Q1–3), `china - q 4-5-6` (49, Q4–6), `general` (8,
couple photos → intro/finale/fallback), `germany` (0 — may be filled overnight, Q7),
`laputz the dog` (4, Q11), `yonatan` (16, Q13 + finale). Questions with no dedicated
photos (Q7–10, Q12 as of now) fall back to a short reveal reusing couple photos; if the
user adds folders (`germany`, `wedding`, `italy`, `songs`) overnight they are folded in.

## Architecture
Single static vanilla web app — no frameworks, no build step (maximum reliability for a
one-night build + GitHub Pages + iPad Safari).

```
index.html            single page, all screens as sections
css/style.css         theme, RTL layout, animations (Ken Burns, confetti, transitions)
js/app.js             state machine: intro → (question → reveal → slideshow) ×13 → finale
js/data/questions.js  questions + answers + correct index + photo manifest (JS, not JSON,
                      so file:// also works — no fetch/CORS dependency)
assets/photos/qNN/    processed photos per question (resized ≤1600px, EXIF/GPS stripped)
assets/photos/intro/  opening + finale montage photos
assets/audio/         music loops + stingers (mp3)
fonts/                self-hosted Hebrew woff2 (display + body)
```

### Screen flow
1. **Intro** — title "13 שנים של אהבה", floating couple photos, big "מתחילים!" button
   (first tap also unlocks iPad audio).
2. **Question** — progress badge (N/13), large question text, 4 answer cards (א–ד) in a
   2×2 grid, distinct warm colors, subtle background music loop.
3. **Reveal** — tapped answer locks in → short drumroll → correct answer glows green +
   hearts/confetti burst; if wrong pick, it dims red gently. No score kept.
4. **Slideshow** — auto-starts: that question's photos with Ken Burns, romantic music,
   ~8s per photo (~1 min); tap anywhere → next question. Preloads next question's images.
5. **Finale** — montage of best photos, "מזל טוב! 13 שנים", closing line callback to
   "הכל לטובה" (dad's army motto, Q3), confetti.

### Audio behavior
Single AudioManager; all playback initiated after first user gesture (iOS requirement).
Crossfade between question loop and slideshow track. Reveal stingers (correct chime,
drumroll) synthesized via WebAudio or tiny mp3s. Mute toggle visible on every screen.

### Error handling
Missing photo folders → question silently gets fallback photos. Image load errors → skip
that slide. Audio failure → app remains fully playable silently.

## Photo pipeline
1. Catalog: agents view every photo, return structured description/quality/orientation.
2. Assign: map photos → questions (china split across Q4/5/6 by content: general trip /
   scenery / Tiger-Leaping-Gorge hiking), best-of set → intro/finale.
3. Process: auto-orient, resize to ≤1600px, recompress (~200-400KB), strip ALL metadata
   (EXIF/GPS — repo is public), output to `assets/photos/`.

## Testing
Drive the full flow in Chrome at iPad viewport (1180×820 landscape + portrait) via
browser automation: all 13 questions, reveals, slideshows, finale; console must be free of
errors; screenshots reviewed for visual quality (RTL correctness, photo framing, contrast).

## Deployment & morning handoff
Push to public GitHub repo (`eliktz` account), enable GitHub Pages, verify the live URL
end-to-end, then write README with the URL + iPad instructions (open in Safari, volume up,
optional add-to-home-screen) and post the same in the session's final message before 8am.
