# MyoPlan

A personal, single-user workout **planning and tracking** app. Desktop-first, runs entirely
in your browser, no server and no login. Built to grow through the phases laid out in
`PROJECT_PLAN.md`.

The three pillars this app is being built toward:

1. **Live muscle heatmap** while you plan a session — see which muscles a workout hits, and
   spot imbalances, across a body diagram at three zoom levels (area → group → specific muscle).
2. **Mesocycle periodization** — week-by-week progression, following the Renaissance
   Periodization / Dr. Mike Israetel framework.
3. **Stimulus-to-fatigue model + XP** — per-muscle progress and projected gains across a
   planned block.

This repository is **Phase 1: the skeleton.** It loads the reference data, joins it correctly,
and lets you browse every exercise, muscle, and structural relationship — plus a live data-health
panel. The heatmap, planner, and tracking come in later phases.

---

## What's in here

```
index.html            The whole app — one self-contained file. This is what runs.
README.md             You are here.
PROJECT_PLAN.md        The living source of truth: data model, phases, decision log.
data/                  The reference data the app reads (6 CSV files).
migration/             Phase-0 migration artifacts (kept for the record; not read at runtime).
build_preview.py       A helper that bakes an offline snapshot into index.html. See below.
_test.js               A logic self-check. See below.
```

---

## How to run it

### The easy way — just open it
Double-click `index.html` and it opens in your browser. Because of a browser security rule,
opening it as a plain file means it can't read the `data/` folder directly, so it falls back to
a **baked-in snapshot** of the data and shows a small "Preview mode" banner. Everything is
browsable; it's just reading a frozen copy of the data rather than the live CSVs.

### The real way — GitHub Pages (recommended, see below)
Once it's hosted on GitHub Pages, the app reads the **live CSVs in `data/`** every time it
loads. Edit a CSV, push it, and the app reflects the change. No "Preview mode" banner. This is
how the app is meant to run day-to-day.

---

## Putting it on GitHub Pages (no terminal needed)

You don't have to touch a command line for any of this.

1. Go to https://github.com and sign in (create a free account if you don't have one).
2. Click the **+** in the top-right → **New repository**.
   - Name it `myoplan` (or whatever name you land on).
   - Set it to **Private** if you'd like — Pages works on private repos with a free account.
   - Leave everything else default and click **Create repository**.
3. On the new repo page, click **uploading an existing file** (the link in the middle).
4. Open this project folder on your computer, select **everything inside it**, and drag it all
   into the browser upload box. Wait for the files to finish uploading.
   - Make sure the `data/` folder comes along with its CSVs — that folder is what makes the
     app work live.
5. Click **Commit changes**. That's your first commit — git is now carrying history. 🎉
6. Go to the repo's **Settings** → **Pages** (left sidebar).
   - Under "Build and deployment", Source = **Deploy from a branch**.
   - Branch = **main**, folder = **/ (root)**. Click **Save**.
7. Wait about a minute, then refresh. Pages will show a green banner with your live URL,
   something like `https://YOUR-USERNAME.github.io/myoplan/`.
8. Open that URL. You should see the app with **no "Preview mode" banner** — that confirms it's
   reading the live CSVs.

### Add the Chrome dock shortcut
On the live Pages URL, in Chrome: **⋮ menu → Cast, save, and share → Install page as app**
(older Chrome: **More tools → Create shortcut**, tick "Open as window"). It'll behave like a
standalone app in your dock — same as your audit tracker.

---

## How the data works (worth knowing)

The app never stores facts in two places. The six CSVs in `data/` are the single source of
truth, and the app joins them by ID at load time:

- `general_areas.csv` — 9 big regions of the body.
- `muscle_groups.csv` — 22 muscle groups.
- `muscles.csv` — 55 specific muscles. **Each muscle's own `Area_ID` is authoritative** — that's
  why the Abdominals group correctly shows up under *both* Core and Lower back.
- `exercises.csv` — 62 exercises and their attributes.
- `exercise_muscle.csv` — the big one (1,250 rows): which muscles each exercise hits, at what
  intensity (1–10), in what role, etc.
- `data_dictionary.csv` — plain-English definitions of every column.

When you add or change exercises later, you edit the CSVs (with AI help, per the plan). The
app's **Data health** tab re-checks integrity every time it loads.

---

## The two helper files (optional, ignore if you like)

- **`build_preview.py`** — regenerates the baked-in offline snapshot so that double-clicking
  `index.html` still shows current data. You only need this if you want the file:// preview to
  match after editing CSVs. Run `python3 build_preview.py` from this folder. It does **not**
  affect the live Pages version, which always reads the real CSVs.
- **`_test.js`** — a quick self-check of the data joins and integrity. Run `node _test.js` from
  this folder; it prints row counts and confirms there are no broken references. Purely a
  sanity tool.

Neither of these is needed to use the app.
