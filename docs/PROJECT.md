# Anniversary Quiz — Project Documentation (as built)

**Live:** https://eliktz.github.io/anniversary-quiz/
**Built:** overnight, July 17→18 2026, for Elik & his wife's 13th wedding anniversary.
**Players:** the two of them + Yonatan (~6), together on one iPad in Safari. Casual play — no scores, no timers.

A self-contained static web app: no frameworks, no build step, no dependencies.
Hebrew, full RTL. Deployed on GitHub Pages straight from `main`.

---

## Experience flow

```
Intro ("משפחת כץ / 13 שנים של אהבה", floating polaroids)
  └─ tap 1: unlocks iPad audio, starts music, shows "ready" screen (+resume offer if a game was interrupted)
  └─ tap 2 ("יאללה, מתחילים!"): question 1
For each of 13 questions:
  Question  — 2×2 answer cards (א–ד, rose/amber/teal/violet, shape icons), soft music loop
  Reveal    — 1.7s drumroll → correct card glows green + hearts confetti;
              wrong pick shakes red, then green reveal. Verdict + personal line
              crossfade into the question card (no layout jump). Auto-advance
              ~4.2s (or tap after 1.6s to move on).
  Slideshow — that question's photos, full-screen Ken Burns, 5.5s/slide,
              crossfade with a "leaving" dip to black (no double-exposure).
              A tap = next photo; tapping past the last photo = next question.
Finale:
  Montage   — "המשפחה שלנו 💙": 13 photos, one per year, chronological family arc
              (couple → newborn Yonatan → … → desert nose-to-nose), to Canon in D.
  End screen — "מזל טוב! אמא, אבא, יונתן ולופץ" + confetti rain + "לשחק שוב".
```

Every phase transition has a tap-guard (350–900ms) so an excited double-tap
can't skip a screen, answer a question, or restart the game by accident.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | Single page; all four screens as `<section class="screen">` |
| `css/style.css` | Whole theme: plum/rose/gold palette, RTL layout, Ken Burns & confetti keyframes, portrait media query |
| `js/app.js` | State machine (intro → question → reveal → slideshow ×13 → montage → end), preloading, tap guards, resume, wake lock |
| `js/audio.js` | Music crossfader + WebAudio synth stingers (see Audio below) |
| `js/confetti.js` | Canvas hearts/sparks particle system (burst + rain) |
| `js/data/questions.js` | **The 13 questions** — edit this to change content |
| `js/data/manifest.js` | Generated photo manifest (`window.PHOTOS`), per-question slide lists with Ken Burns focus positions |
| `assets/photos/qNN/`, `intro/`, `finale/` | Processed photos (≤1600px, ~80 quality, progressive JPEG, **all EXIF/GPS stripped** — the repo is public) |
| `assets/audio/*.mp3` | Music, 112kbps, ≤3–4min with fade-outs |
| `fonts/` | Self-hosted woff2: Secular One (display) + Heebo 400/600/800, hebrew+latin subsets |
| `tools/process_photos.py` | The photo pipeline (see below) |
| `docs/superpowers/specs/…` | The original pre-build design spec (historical; this file is the as-built truth) |

## Data formats

`js/data/questions.js` — one object per question:

```js
{ id: "q07",                       // matches assets/photos/q07/ + manifest key
  text: "לאן אמא ואבא טיילו…?",    // question
  answers: ["גרמניה", …],          // exactly 4, displayed א/ב/ג/ד RTL
  correct: 0,                       // 0-based index into answers
  reveal: "ברלין — אמנות רחוב 🎨" } // personal line shown on reveal + as slideshow title
```

`js/data/manifest.js` — generated; `window.PHOTOS = { q01: [{src, w, h, pos}], …, intro: […], finale: […] }`.
`pos` is a CSS `background-position` derived from where faces sit in the photo
(from an AI content-analysis pass) so the Ken Burns crop keeps subjects in frame.

## Photo pipeline (`tools/process_photos.py`)

Source photos live outside the repo in `~/Desktop/quiz-raw-photos/<topic>/`.
The script holds the **assignment map** (which source photo goes to which
question, in what order), then for every photo:

1. `ImageOps.exif_transpose` — bake EXIF rotation into pixels (several photos were stored sideways)
2. resize to ≤1600px, save progressive JPEG q80 **without metadata** (strips EXIF/GPS)
3. writes `assets/photos/...` and regenerates `js/data/manifest.js`

To change photo sets: edit `ASSIGN` in the script, run
`python3 tools/process_photos.py` (needs Pillow), commit, push.
Note: it also reads a photo-catalog JSON from the original session's scratchpad
for focus hints; without it, positions default to center — fine for most shots.

## Audio system (`js/audio.js`) — the iPad-specific part

- **Unlock:** iOS allows sound only after a user gesture. The first tap
  (`btn-start`) creates the `AudioContext` and "blesses" both `<audio>`
  elements by playing 0.1s of silence, so later programmatic `play()` works.
- **Volume on iOS:** iPadOS **ignores** `HTMLMediaElement.volume`. Each player
  is therefore routed through a WebAudio `GainNode` at unlock
  (`createMediaElementSource`); all volume changes/crossfades go through the
  gain when available, falling back to `.volume` elsewhere. Mute additionally
  sets `.muted`, which iOS does honor.
- **Crossfades:** two alternating `<audio>` elements, 50ms-tick fade between
  the outgoing track's *actual* current volume and the incoming target.
- **Interruption healing:** app switch / screen lock / Siri suspends audio.
  `visibilitychange` and any `pointerdown` call `AudioMan.resume()` (resumes
  the context and re-plays a paused current track).
- **Stingers** (tap, drumroll, correct arpeggio, gentle wrong, fanfare) are
  synthesized with WebAudio oscillators/noise — no files.
- **Preload:** after the first tap all 7 tracks are warmed with staggered
  throwaway `Audio` loads; photos are warmed folder-by-folder in play order.
- Tracks: Kevin MacLeod (CC-BY 4.0) — intro "Carefree", question "Thinking
  Music", slideshows rotate "Air Prelude"/"Gymnopedie No 1"/"Wholesome"/
  "Dreams Become Real", finale "Canon in D Major".

## Resilience details

- **Resume:** `localStorage["quiz-q"]` is written on every question and
  cleared at the end screen. After a reload (Safari memory purge, accidental
  re-open), the ready screen offers "או: להמשיך משאלה X ⏩".
- **Pinch-zoom:** blocked via `gesturestart/gesturechange` preventDefault
  (iOS ignores `user-scalable=no`); `overscroll-behavior: none` prevents
  pull-to-refresh rubber-banding.
- **Wake lock:** requested on start and re-acquired on visibility change, so
  the screen doesn't sleep mid-slideshow.
- **Missing assets:** a question with no photos skips its slideshow; image
  load failures skip a slide; audio failure leaves the app fully playable silently.
- **Runs from anywhere:** data is plain JS (no fetch/CORS), so it also works
  from `file://` — but GitHub Pages/localhost is the intended path.

## Development & deployment

```bash
# local dev
python3 -m http.server 8137        # from the repo root
open http://localhost:8137

# deploy = just push; GitHub Pages serves main/ (≈1 min to update)
git push
```

There is intentionally no bundler, minifier, or framework: the whole app is
~1,300 lines that must survive being edited at 7am on zero sleep.

## How it was built & verified (one night)

1. **Content:** 13 questions parsed from the family's Google Doc (correct
   answers were `*`-marked). ~84 photos: an 11-agent fleet viewed every photo
   and produced a structured catalog (description, quality, orientation, face
   position) used for question assignment and Ken Burns focus.
2. **Gaps filled:** Larnaca (wedding city, Q10) and Italy (honeymoon, Q12) had
   no personal photos — location shots pulled from Wikipedia/Wikimedia (user-approved).
3. **Review:** an 18-agent adversarial review (visual-design critic, iPad
   Safari engineer, kid-UX reviewer + skeptical verifiers) produced 14
   confirmed findings — all applied. Highlights: the iOS volume bug, the
   montage double-exposure crossfade, muddy dimmed answers, tap-race guards,
   tap-advance slideshows.
4. **Completeness critic:** a final fresh-eyes pass found 4 gaps (reload
   resume, pinch-zoom, audio preload, README wording) — all applied. It also
   re-verified every question/answer against the original questionnaire.
5. **Testing:** scripted full 13-question playthroughs (right + wrong answer
   paths, tap-advance, replay, reload-resume) on Chromium **and** WebKit
   (Safari engine), landscape + portrait iPad viewports, locally and against
   the live GitHub Pages URL. Zero console errors, zero failed requests.
6. **Morning feedback round:** intro retitled "משפחת כץ" with more Yonatan
   polaroids; finale rebuilt as a 13-photo chronological family arc titled
   "המשפחה שלנו 💙" (removed "הכל לטובה" and "13 שנים של אהבה" from it).

## Known limitations / notes

- The family's song ("Piangi con me" — Bee Bee Sea) is not included: it can't
  be legally downloaded. To use it: drop an mp3 at `assets/audio/`, reference
  it in `TRACKS` in `js/audio.js` (e.g. as the finale track), push.
- Photos in this repo are on the public internet (user explicitly accepted);
  they are EXIF/GPS-stripped, but faces are visible. Making the repo private
  would take the site down on the free plan.
- `intro` photos from the `general` folder are low-res (414px) — fine as small
  polaroids, soft if ever used full-screen.
- Real-device audio behavior (gain routing, interruption healing) is hardened
  per WebKit documentation and tested on the WebKit engine, but was not
  verifiable on physical iPad hardware overnight.
