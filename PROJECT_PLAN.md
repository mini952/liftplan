# LiftPlan — Workout Planning & Tracking App — Project Plan

**Status:** Living document. This is the working reference for the project inside the Claude project.
**Last updated:** 2026-07-10
**Owner:** Single user (personal use)

> **How to use this file:** Sections 1–5 are the settled foundation (vision, rules, platform, data model, migration). Section 6 is the build roadmap. Section 7 is the decision log — the running record of what's *decided* vs. *parked*, and this is the section that changes most often. When a parked decision gets resolved, move it up into "Decided" with a date. When the databases and this document disagree, **the databases win** (see Rule R1).

---

## 1. Project Overview & Vision

A personal, single-user workout **planning and tracking** application. Three pillars:

1. **Planning with a live muscle "heatmap."** As a training week is built, a body diagram shades each muscle by how much it's being worked, so imbalances (e.g. lots of chest, little shoulder) are visible *while planning*, at three granularity levels — General Area, Muscle Group, and Specific Muscle.
2. **Mesocycle-based tracking (Renaissance Periodization style).** A repeated week × N weeks + a deload week = a **mesocycle**; stacked mesocycles = a **macrocycle**. Progression is planned as a ramp and tracked against what was actually done.
3. **A stimulus/fatigue model + gamification.** Each exercise carries per-muscle intensity data. That rolls up into per-workout stimulus and fatigue, models the fact that the *first* exercise in a session gets the freshest work, and surfaces progress as **XP** ("+3 biceps, +4 traps") — including a *projected XP range* across a planned mesocycle.

The system is built on three source-of-truth databases (Exercises, Muscles, and the Exercise–Muscle relationship table), and is developed with heavy AI assistance both at build time and at runtime (to keep the databases consistent as new exercises are added).

---

## 2. Standing Rules & Principles

These are project-wide invariants. They resolve disputes without re-litigating.

- **R1 — The databases are the source of truth.** The ChatGPT handoff document is history and context only. When the data and the doc conflict, the data wins and the doc/this plan is updated to match — never the reverse.
- **R2 — Join on IDs, never on text.** Every relationship is keyed by `Exercise_ID` / `Muscle_ID`. Names are display-only and may change freely without breaking anything.
- **R3 — Store facts once; derive everything else in code.** The app computes joins, roll-ups, text labels, volume, and XP at runtime. Stored data stays minimal and non-redundant.
- **R4 — A fact row exists only when a muscle is genuinely involved.** Absence of a row means "not meaningfully worked." There is no stored `0`; `1` is the floor (minimally involved). All involvement down to `1` is *retained* in the data and hidden only at display, via an adjustable threshold (D-09/R6) — so the table is deliberately **inclusive, not lean**. In practice the migrated seed is **dense and uniform** (every analyzed exercise currently carries the same ~50 muscles; see §4.2), as expected of group-grain migration-era data; Phase 8 turns that into real per-exercise involvement (D-29).
- **R5 — Reference data is read-only at runtime; personal data is read-write.** Reference tables live in the repo and are edited by the user + AI. Personal data (plans, logs, XP) lives in the browser and is exported/imported by the user.
- **R6 — Keep the analysis, filter at display.** All muscle involvement (down to intensity 1) is retained in the data. The heatmap applies an adjustable *display threshold* to hide trivial involvement. Filtering is a view setting, not a data deletion.
- **R7 — Consistency over speed.** Repeatable frameworks (the coverage checklist, fixed intensity cutoffs, ID mapping) are preferred over one-off intuition, to prevent drift across exercises.

---

## 3. Platform & Deployment Architecture

**Target:** a real application the user runs — a self-contained static web app (HTML/CSS/JS), desktop-first. All logic runs client-side; there is no server.

**Deployment (mirrors the existing audit-tracking app):**
- The app is a static bundle in a **GitHub repository**.
- **GitHub Pages** serves it at a stable URL, so the URL always points to the latest pushed version.
- A **Chrome "Install / Create shortcut"** gives a dock/desktop icon that opens the app directly.
- Updates ship by pushing to the repo — no reinstall, no manual file-swapping.

**Two data homes** (a direct consequence of GitHub Pages being read-only from the browser):

| Data | Home | Read/Write at runtime | Edited by |
|---|---|---|---|
| Reference data (exercises, muscles, exercise–muscle) | CSV files in the repo | Read-only (fetched on load) | User + AI, in the repo |
| Personal data (plans, mesocycles, logged sets, XP) | Browser storage, keyed to the app URL | Read-write | The app / the user |

- Personal data **persists across code updates** because it's tied to the app's origin, not bundled with the code.
- A **JSON export / import** feature is the backup mechanism and the future migration path to a phone. The user is responsible for exporting (there is no automatic cloud sync in v1).

**Development caveat (already understood):** previews built inside the Claude project cannot use browser storage, so prototypes run on **in-memory** data. The production GitHub Pages build uses persistent browser storage. It's the same code with one storage swap — designed for from the start.

**Parked platform items:** native iPhone app; automatic cloud sync. (See §7.)

---

## 4. Data Architecture

### 4.1 Storage strategy

- **Reference / source-of-truth tables → CSV**, one file per table, joined by IDs. Any tool (the app, Excel, Sheets, an LLM) can read and hand-edit them as plain text. The app performs all joins and math in code.
- **Personal / app-generated data → JSON** (in browser storage), because plans nest naturally (program → mesocycle → week → day → exercise → sets).
- **SQLite is held in reserve.** If the app grows, needs heavier querying, or moves to a phone, a SQLite database can be auto-generated *from* the CSVs. Not used in v1 — it's a binary file and therefore not directly AI-editable as text, which conflicts with the current "AI edits the data directly" priority.

### 4.2 Entity relationships

```
general_areas (9)
      ▲
      │ Area_ID
      │
muscle_groups (~22) ──Group_ID──►  muscles (~56)
                                        ▲
                                        │ Muscle_ID
                                        │
exercises (~62) ──Exercise_ID──►  exercise_muscle  (the fact table; one row per involved pair, ≥1)
```

- `exercise_muscle` is the heart of the system: **one row = one genuinely-involved exercise–muscle pair.**
- Everything the old sheets stored redundantly (muscle names, group, area, text intensity labels, "main muscle") is **derived in the app** from these IDs, not stored.

### 4.3 CSV schemas (reference data)

Notes on conventions: IDs are stable strings (`EX0001`, `MU0001`, `MG0001`, `MA0001`). Intensity is an **integer 1–10**. Controlled-vocabulary fields list allowed values.

#### `general_areas.csv` — 9 rows (canonical body regions)
| Column | Type | Notes |
|---|---|---|
| `Area_ID` | string PK | `MA0001`… |
| `Area_Name` | string | Lower legs, Upper legs, Core, Lower back, Upper back, Shoulders, Chest, Arms, Forearms |
| `Display_Order` | int | Head-to-toe ordering for UI |

#### `muscle_groups.csv` — ~22 rows
| Column | Type | Notes |
|---|---|---|
| `Group_ID` | string PK | `MG0001`… |
| `Group_Name` | string | e.g. Quadriceps, Trapezius, Pectorals |
| `Group_Nickname` | string | short label for tight UI |
| `Default_Area_ID` | string FK → general_areas | the *usual* area; authoritative area lives on the muscle (see quirk in §5.3) |
| `Display_Order` | int | |

#### `muscles.csv` — ~55 rows (canonical specific-muscle list)
| Column | Type | Notes |
|---|---|---|
| `Muscle_ID` | string PK | `MU0001`… |
| `Specific_Muscle` | string | e.g. Vastus Lateralis |
| `Nickname` | string | e.g. Vastus Lat |
| `Function` | enum | `Propulsion` \| `Stability` — inherent, exercise-*independent* muscle character; distinct from per-exercise `Muscle_Role` (P-18) |
| `Group_ID` | string FK → muscle_groups | |
| `Area_ID` | string FK → general_areas | **authoritative** area for this muscle |
| `Head_To_Toe_Order` | number | ordering |

Changes from the current Muscle DB: **add Brachioradialis** (it appears in the fact table but not the muscle list); **do not** add a separate Extensor Digitorum — it's folded into Forearm (Extensors); **restructure obliques** — remove the generic `Obliques` row and replace External/Internal Oblique with **Obliques - Upper** and **Obliques - Lower** (regional, matching the Pec/Trap/Delt convention; see §5.3). Spelling fixes (§5.3).

#### `exercises.csv` — ~62 rows
| Column | Type | Notes |
|---|---|---|
| `Exercise_ID` | string PK | `EX0001`… |
| `Exercise_Name` | string | display only; naming format `Exercise; single/both - Variation - (Equip)` (see data dictionary) |
| `Category` | enum | `Compound` \| `Isolation` \| `Plyometric` |
| `Equipment` | enum | `Barbell` \| `Dumbbell` \| `Cables` \| `Machine` \| `Body weight` \| `Other` — **physical kit only** (D-23) |
| `Tracking_Mode` | enum | `Reps` \| `Time` (default `Reps`; `Distance` reserved) — how the exercise is measured/progressed; **not** equipment (D-23) |
| `Movement_Type` | enum | `Unilateral` \| `Bilateral` \| `Contralateral` \| `Ipsilateral` |
| `Rotational` | bool | Yes/No |
| `Active` | bool | from the old "Current Use Tag" (`x`); whether it's in current rotation |
| `Description` | string | what the movement is / how it differs from look-alikes (anchor, ROM, focus); planner tooltip; distinct from Notes (D-26) |
| `Notes` | string | optional catch-all |

Dropped from the old sheet: `Repeat`, `Main Muscle`, `Main Muscle Group Nickname` — the "main muscle" is **derived** as the highest-intensity `Primary` row in the fact table, not stored (R3). `Repeat` (always `1`) carried no data; its intent — don't create duplicate exercises — becomes an app-level uniqueness rule (D-25), not a stored field.

**Companion file:** a standalone `data_dictionary.csv` documents every column of all five tables (type, allowed values, format rules, descriptions) plus key derived fields. It is the authoritative home for the old in-sheet "Criteria" knowledge — the exercise-name format, the enum lists, and the derivation rules (D-24).

#### `exercise_muscle.csv` — the fact table (inclusive; one row per genuinely-involved pair, intensity ≥1, R4)
| Column | Type | Notes |
|---|---|---|
| `EM_ID` | int PK | surrogate key |
| `Exercise_ID` | string FK → exercises | filled on **every** row (old sheet only filled the first row of each block) |
| `Muscle_ID` | string FK → muscles | **replaces the old text muscle name** (R2) |
| `Muscle_Role` | enum | `Primary` \| `Secondary` \| `Stabilizer` — per-exercise (varies lift to lift); distinct from the muscle's inherent `Function` |
| `Intensity_Value` | int 1–10 | **the truth**; text labels derived (R3) |
| `Intensity_Source` | enum | `Group` \| `Specific` — provenance for the inherit-from-group rule (§4.5) |
| `Contraction_Type` | enum | `Isotonic` (doing dynamic work) \| `Isometric` (holding position) — per pair |
| `Notes` | string | rationale, e.g. "prevents spinal rounding; near-maximal" |

**Derived in the app, never stored here:** exercise name, muscle name, group, area, text intensity level, "main muscle."

### 4.4 Derived fields (computed in code, not stored)

- **Text intensity label** ← from `Intensity_Value` via fixed cutoffs (cutoffs = parked, §7).
- **Main / primary mover of an exercise** ← highest-intensity `Primary` row.
- **Muscle group & area for a fact row** ← follow `Muscle_ID` → `muscles.csv`.
- **Sets per muscle / group / area per week** ← join planned/logged sets to fact rows, roll up.
- **Volume, stimulus, fatigue, SFR, XP** ← formulas TBD (parked, §7).

### 4.5 The inherit-from-group rule (granularity)

The canonical muscle list keeps **all specific muscles** (all four vasti, all pec/triceps heads, etc.). But an analysis may assign intensity at the **group** level and let it flow down to every head of that group, tagged `Intensity_Source = Group`. A head is only broken out with its own value (`Intensity_Source = Specific`) when a specific exercise genuinely biases it.

**Expected consequence:** early on, the Specific-Muscle heatmap and the Group heatmap will often look identical, because most values are inherited. The Specific view becomes more informative only as heads are deliberately differentiated over time. This is correct behavior, not a bug.

### 4.6 Personal-data JSON (draft — depends on parked decisions)

These shapes are a v1 sketch; fields tied to parked formulas (XP, fatigue) will firm up in later phases.

```jsonc
// program (macrocycle)
{
  "id": "prog_01",
  "name": "Winter Block",
  "mesocycles": [{
    "id": "meso_01",
    "name": "Hypertrophy A",
    "weeks": 6,
    "deloadWeek": true,
    "microcycle": {                       // the repeated week template
      "days": [{
        "id": "day_push_a",
        "name": "Push A",
        "exercises": [{
          "exerciseId": "EX0017",
          "order": 1,                     // order drives the "freshness" model
          "plan": {                       // planned ramp across the weeks
            "startWeight": 60, "startReps": 8, "startRIR": 3,
            "weekly": [                   // app pre-fills; user adjusts
              { "week": 1, "weight": 60, "reps": 8,  "rir": 3 },
              { "week": 2, "weight": 60, "reps": 9,  "rir": 2 },
              { "week": 3, "weight": 60, "reps": 10, "rir": 1 },
              { "week": 4, "weight": 65, "reps": 8,  "rir": 3 }
            ]
          }
        }]
      }]
    }
  }]
}
```

```jsonc
// logged sessions (what actually happened)
{
  "sessions": [{
    "id": "sess_2026_07_09",
    "date": "2026-07-09",
    "mesocycleId": "meso_01",
    "weekNumber": 1,
    "dayId": "day_push_a",
    "entries": [{
      "exerciseId": "EX0017",
      "order": 1,
      "sets": [
        { "set": 1, "weight": 60, "reps": 8, "rir": 3 },
        { "set": 2, "weight": 60, "reps": 8, "rir": 2 }
      ]
    }]
  }]
}
```

```jsonc
// XP state (per specific muscle; group/area rolled up in app)
{
  "byMuscle": {
    "MU0048": { "xp": 12, "history": [ { "date": "2026-07-09", "delta": 3, "reason": "Push A" } ] }
  }
}
```

Logged per set (from the Strong-app pattern): **weight, reps, RIR/RPE.** Rest is optional/likely unused; **tempo** is a possible optional qualifier (parked).

---

## 5. Data Migration Plan (Google Sheets → CSV)

The current databases are Google Sheets exported to `.xlsx`. The cross-sheet `IMPORTRANGE`/`XLOOKUP` array formulas are **dead** in the exports (they reference three separate Google Sheet IDs), and the fact table is currently text-keyed and denormalized. Migration converts them into the clean, ID-keyed CSVs of §4.3.

### 5.1 Steps

1. **Extract** each source tab to a raw CSV.
2. **Build the reference tables** (`general_areas`, `muscle_groups`, `muscles`, `exercises`) with stable IDs, applying the cleanup list in §5.3.
3. **Add IDs to the fact table.** Fill `Exercise_ID` down every row (currently only on the first row of each exercise block). Map each text muscle name → `Muscle_ID`.
4. **Reconcile muscle grain via inheritance (R4 + §4.5).** Coarse fact-table entries map down to specific muscles with `Intensity_Source = Group`:
   - `Quadriceps = 7` → all four vasti = 7 (`Group`).
   - `Trapezius = 6` → Traps High/Mid/Low = 6 (`Group`).
   - `Biceps (Long Head)` / `(Short Head)` are already specific → map directly (`Specific`).
   This means the **25 already-analyzed exercises are kept**, not thrown away — they become valid group-grain seed data.
5. **Fold / add muscles.** Add Brachioradialis to `muscles.csv`; fold Extensor Digitorum intensity into Forearm (Extensors).
6. **Drop dead columns** (all `#N/A` lookup columns and the stored `IMPORTRANGE` formula text) and the hand-typed area column (derive area via `Muscle_ID`).
7. **Coerce types** (`Intensity_Value` float `9.0` → int `9`) and **normalize vocab** (Intensity_Level text discarded — derived later; Contraction reduced to Isotonic/Isometric). Split `Equipment=Time` → `Equipment=Other` + `Tracking_Mode=Time` (D-23).
8. **Write the data dictionary** (`data_dictionary.csv`, D-24) documenting every column of all five tables + key derived fields.
9. **Validate** (§5.2).
10. **Seed set going forward.** The migrated 25 (group-grain) are the starting seed. New exercises are added deliberately via the AI coverage-checklist workflow (§6, Phase 7), at specific grain where justified — rather than bulk-importing all 62 at once.

### 5.2 Validation checks (run after every data edit)

- Every `Exercise_ID` in `exercise_muscle` exists in `exercises`.
- Every `Muscle_ID` in `exercise_muscle` exists in `muscles`.
- Every `Group_ID`/`Area_ID` FK resolves.
- `Intensity_Value` is an integer in 1–10 (no 0s — R4).
- `Muscle_Role`, `Contraction_Type`, `Intensity_Source` are within their allowed sets.
- No duplicate (`Exercise_ID`, `Muscle_ID`) pair.

### 5.3 Data-quality cleanup list (found during review)

- **Exercise name typos:** `Foces` (EX0056) → Focused (in the exercise name). The `Cheest` typo (EX0020) lived in the old "Main Muscle Group Nickname" column, which is dropped — so it disappears automatically; the EX0020 exercise name itself is clean.
- **Tracking-mode reclassification (D-23):** the old `Equipment = Time` was a measurement mode, not kit. Only EX0031 (Bosu Ball Balance Hold) had it → migrated to `Equipment = Other`, `Tracking_Mode = Time`. All other exercises → `Tracking_Mode = Reps`. *(Equipment = Other for EX0031 is a judgment call — a Bosu ball is specialized kit, not plain body weight; flip to `Body weight` if preferred.)*
- **Muscle spellings:** `Glutes Minimus` → Gluteus Minimus; `Coracorbrachialis` → Coracobrachialis; `Bicep Femoris` → Biceps Femoris.
- **Obliques restructure (decided, D-21):** remove the generic `Obliques` row (MU0019); replace External Oblique (MU0020) + Internal Oblique (MU0021) with **Obliques - Upper** and **Obliques - Lower**. Rationale: the internal/external distinction is a muscle-layer difference with no training actionability (the layers co-activate and can't be isolated), whereas upper/lower is at least somewhat trainable via movement selection and matches the regional convention already used for Pecs/Traps/Delts. This is a re-conceptualization, not a rename. *Migration:* existing "External Oblique" / "Internal Oblique" fact entries (scored equally in the analyses) map onto **both** new muscles carrying that shared value; differentiate Upper vs. Lower later when an exercise justifies it.
- **Lower back area (decided):** keep "Lower back" as its own distinct General Area (Erector Spinae + QL). Not merged into Core, because those muscles are posterior and the heatmap needs them placed/highlighted separately from the anterior abs. The group-spanning-two-areas quirk is already neutralized by storing `Area_ID` on the muscle (P-15 is therefore optional, not required).
- **Group-spans-two-areas quirk:** the `Abdominals` group contains Erector Spinae + Quadratus Lumborum, which sit in the **Lower back** area while the rest sit in **Core**. This is why `Area_ID` is stored *on the muscle* (authoritative), not derived from the group. Optional future cleanup: split those into their own group (parked, §7 D-15).
- **Missing function values:** Iliacus / Psoas (Hip Flexor group) have no `Function` — leaning **Stability**; finalize during the Phase 0 cleaning pass.
- **Fact-table names vs. canonical names** differ throughout (e.g. `Biceps (Long Head)` vs `Biceps Brachii - Long Head`) — resolved by the ID mapping in step 3; a mapping table is produced as a migration artifact.

---

## 6. Build Phases / Roadmap

Phases are sequenced so each one produces something usable and de-risks the next. Parked decisions are resolved *inside the phase that needs them*, not up front.

**Phase 0 — Data foundation. ✓ Complete (2026-07-10).**
Migrate Sheets → the five clean CSVs (§5). Produce the muscle-name→ID mapping table and the `data_dictionary.csv` (D-24). Run validation (§5.2). *Deliverable:* a validated, ID-keyed dataset + data dictionary. *No app yet.*

**Phase 1 — App skeleton on GitHub Pages. ✓ Complete (2026-07-10).**
Static HTML/JS that fetches the CSVs, performs ID joins in code, and displays the databases (browse exercises, muscles, and an exercise's involved muscles). JSON export/import stub. Confirm the GitHub Pages + Chrome-shortcut workflow end-to-end. *Deliverable:* a live, installable app that reads real data.
*Shipped:* single self-contained `index.html` (fetches `data/*.csv` live on Pages, falls back to a baked-in snapshot for offline/preview). Four views — Exercises, Muscles, Structure, Data-health (live §5.2 integrity checks). JSON export/import stub. **Deployed and live** on GitHub Pages from the public repo `liftplan` (`https://mini952.github.io/liftplan/`), installable as a Chrome dock app with the LP icon. App named **LiftPlan** (D-28) with the aqua-on-ink `LP` icon (rounded master + opaque square/maskable variant + `manifest.webmanifest` for a clean installed icon). Phase-1 validation checklist run and passed (no preview banner = live CSVs; spot-checks correct; Abdominals under both Core + Lower back; all integrity checks green; export/import round-trips; dock shortcut opens correctly).

**Phase 2 — Planning core.**
Build a program → mesocycle → week template → day → ordered exercise list. Persist to browser storage. Exercise *order* is captured (feeds the freshness model later). *Deliverable:* can construct and save a plan.

**Phase 3 — Muscle heatmap (top priority).**
Body diagram with the 9 general areas; switch between Area / Group / Specific granularity; adjustable display threshold (R6). *Resolves:* **shading metric** (built to toggle set-count vs. intensity), and **6-vs-9 diagram rendering** (leaning 9). *Deliverable:* the visual imbalance view during planning.

**Phase 4 — Volume & stimulus analysis.**
Sets-per-muscle-per-week roll-ups; imbalance/under-/over-training flags; the **within-session freshness model** (first exercise = freshest). *Resolves:* freshness rule (position multiplier vs. running-fatigue counter) and fatigue-assignment formula. *Optionally introduces* RP volume landmarks (MEV/MAV/MRV) if wanted. *Deliverable:* objective per-week volume analysis.

**Phase 5 — Tracking & logging.**
Log weight / reps / RIR per set against the plan; progression charts across the mesocycle; plan-vs-actual comparison. *Resolves:* whether the planner *prescribes* next-session loads (the 6-week ramp auto-fill that the user can override); tempo as optional qualifier. *Deliverable:* the tracking experience.

**Phase 6 — XP & gamification.**
XP engine (leaning weight × reps × intensity), tracked per specific muscle and rolled up to group/area; **decay** tracked separately and summed (e.g. +4 over weeks, −1 for a week off); **projected XP as a range** built from planned ramp assumptions, shown during planning. *Resolves:* the XP formula and decay model. *Deliverable:* progress gamification + projected-gain preview.

**Phase 7 — AI data-maintenance workflow.**
A reusable, drift-resistant prompt + the 5-domain **coverage checklist** (below) for analyzing a new exercise into specific-grain fact rows; a validation pass (§5.2) on every addition. *Deliverable:* a repeatable "add a new exercise" pipeline that keeps the dataset consistent.

**Phase 8 — Muscle-list refinement + full re-analysis (post-MVP).**
The migrated seed is group-grain and carries several migration-era placeholders; this phase makes them real, using the Phase 7 workflow. Two parts:
1. **Muscle-list refinement.** Split Rectus Abdominis → Upper / Lower (D-27, same regional convention as the obliques). Review `Function` assignments (incl. the P-18 "does it earn its keep" call, and Iliacus/Psoas). For each multi-head group currently inheriting one value (the four vasti are the prime case, also the glutes, hamstrings, traps, pec-major heads), **either differentiate the heads with head-specific scores or consciously consolidate** them if they never meaningfully diverge for these exercises — turning §4.5 placeholders into decisions.
2. **Full re-analysis.** Re-run every exercise through the Phase 7 coverage-checklist at specific grain. This overwrites the group-grain seed *and* the Phase-0 migration judgment calls that were only ever provisional — the extensor-compartment fold (max-of-two), the oblique Upper/Lower direction, and every `Intensity_Source = Group` row. *Resolves:* **P-16**. *Deliverable:* a fully specific-grain, re-scored fact table.

**Later / parked:** native iPhone app; auto cloud sync; SQLite generation; eccentric-emphasis contraction refinement; advanced fatigue/SFR dashboards.

### Coverage checklist (carried from the handoff doc, kept as methodology)

For every exercise, explicitly evaluate five domains so muscles aren't silently omitted:
1. **Primary movers** — which muscles produce the movement.
2. **Major synergists** — which materially assist.
3. **Joint & segment controllers** — scapula, hip, shoulder, knee (rhomboids, mid/low trap, glute med, rotator cuff).
4. **Core & anti-movement demand** — anti-extension / anti-rotation / anti-lateral-flexion / bracing (rectus abdominis, obliques, TVA, QL).
5. **Distal limiters** — grip / foot / ankle (forearms, tibialis, peroneals, calves).
Final check per omitted muscle: would fatigue there reduce performance, does it accumulate meaningful fatigue, would omitting it distort analysis? If yes to any → include it.

---

## 7. Decision Log

### 7.1 Decided

| # | Decision | Resolution | Date |
|---|---|---|---|
| D-01 | Scope | Single user, personal | 2026-07-09 |
| D-02 | App type | Real app: static HTML/JS, desktop-first | 2026-07-09 |
| D-03 | Deployment | GitHub repo + GitHub Pages (stable URL, always latest) + Chrome shortcut icon | 2026-07-09 |
| D-04 | Logic location | All joins + math client-side, in code | 2026-07-09 |
| D-05 | Reference storage | CSV, one file per table, joined by IDs | 2026-07-09 |
| D-06 | Personal storage | JSON in browser storage; user-driven JSON export/import for backup + future phone | 2026-07-09 |
| D-07 | SQLite | Held in reserve; can be generated from CSVs later | 2026-07-09 |
| D-08 | Source of truth | Databases win over the handoff doc (Rule R1) | 2026-07-09 |
| D-09 | Sparse vs dense | Keep all analysis; heatmap applies adjustable display threshold (R6) | 2026-07-09 |
| D-10 | Keys | Exercise_ID + Muscle_ID on every fact row; names display-only (R2) | 2026-07-09 |
| D-11 | Muscle granularity | Keep all specific muscles; inherit-from-group when heads can't be differentiated; split only when justified (§4.5) | 2026-07-09 |
| D-12 | Muscle list edits | Add Brachioradialis; fold Extensor Digitorum into Forearm (Extensors) | 2026-07-09 |
| D-13 | Intensity model | 1–10 integer is truth; text labels derived from fixed cutoffs | 2026-07-09 |
| D-14 | Zero handling | No stored 0; 1 = floor; absence of row = not involved (R4) | 2026-07-09 |
| D-15 | Contraction type | Isotonic / Isometric, per exercise–muscle pair | 2026-07-09 |
| D-16 | Canonical regions | Muscle DB's 9 General Areas | 2026-07-09 |
| D-17 | Fact-row creation rule | Add a row only when a muscle is genuinely involved (R4) | 2026-07-09 |
| D-18 | XP projection style | Range built from planning assumptions (rep targets, RIR), not a single number | 2026-07-09 |
| D-19 | AI usage | AI at build time (app) **and** runtime (data consistency via coverage checklist) | 2026-07-09 |
| D-20 | Seeding | Start from the migrated group-grain 25; grow deliberately, not by bulk-importing all exercises | 2026-07-09 |
| D-21 | Obliques | Remove generic Obliques; replace Ext/Int Oblique with Obliques - Upper / Obliques - Lower (regional, matches Pec/Trap/Delt convention) | 2026-07-09 |
| D-22 | Lower back area | Keep as its own distinct General Area (not merged into Core); posterior placement matters for the heatmap | 2026-07-09 |
| D-23 | Tracking mode split | `Equipment` is physical kit only; new `Tracking_Mode` enum {`Reps`,`Time`} (default `Reps`, single value per exercise, `Distance` reserved) captures how an exercise is measured/progressed. Old `Equipment=Time` (EX0031 only) → `Equipment=Other` + `Tracking_Mode=Time`. Logging/progression behavior for time-based sets deferred to Phase 5. | 2026-07-09 |
| D-24 | Data dictionary | Standalone `data_dictionary.csv` covering all five tables + key derived fields; authoritative home for column meanings, types, allowed values, the exercise-name format, and derivation rules. Replaces the old in-sheet "Criteria" row. Kept as CSV (machine-readable → app validation + dropdowns). | 2026-07-09 |
| D-25 | Exercise de-duplication | App-level uniqueness rule prevents creating a duplicate exercise (same movement + equipment + variation). No stored field; replaces the dead `Repeat` column. Variant *grouping* (a stored relationship) is a separate, parked concern (P-17). | 2026-07-09 |
| D-26 | Exercise description field | Add a `Description` column to `exercises.csv` (what the movement is / how it differs from look-alikes, e.g. reverse-hyper vs hyper). Distinct from `Notes`; app can show it as a tooltip. Empty now, filled opportunistically; disambiguation-critical ones before the Phase 8 re-analysis. | 2026-07-10 |
| D-27 | Rectus Abdominis split | Split RA into Upper / Lower (regional, same convention as the obliques D-21). *Decided now; executed in Phase 8* alongside the re-analysis, so upper/lower values are assigned in one deliberate pass rather than duplicating the current single RA score. | 2026-07-10 |
| D-28 | App name + icon | **LiftPlan** (working choice, "for now"), from the shortlist after pressure-testing (availability / logo / sound). Clean as an exact-string name; crowded lift-app field is the only downside (acceptable for single-user personal use). Icon = Roboto Slab Bold `LP` monogram, aqua `#31D3D0` on ink `#0F172A`; 1024×1024 master with rounded/transparent corners. `MesoQuest` reserved for the gamified tracking view (not the app). Revisit only if a stronger name emerges before the repo is created. *(Full rationale + rejected options archived in `docs/naming_and_icon_handoff.md`.)* | 2026-07-10 |
| D-29 | Fact-table density labeling | Relabel the exercise–muscle table from "sparse" to **inclusive / dense** across the plan, to match the data (R1). No data or app change — a truth-in-labeling fix. Reflects that the migrated seed retains all involvement down to intensity `1` (D-09/R6) and is currently dense and uniform (the same ~50 of 55 muscles on every one of the 25 analyzed exercises; 74% of rows at intensity ≤3). Phase 8 resolves this into real per-exercise involvement. | 2026-07-10 |

### 7.2 Parked (decide in the noted phase)

| # | Open decision | Resolve in | Notes |
|---|---|---|---|
| P-01 | Heatmap shading metric (set-count vs. intensity) | Phase 3 | Build to support both as a toggle |
| P-02 | 6-vs-9 diagram rendering | Phase 3 | Leaning 9 distinct zones; also decide the display label for the Lower back area (e.g. "Lower back" vs. "Core (lower back)") — cosmetic only |
| P-03 | Intensity text-label cutoffs (which values → which labels) | Phase 3/5 | e.g. where High/Moderate/Low boundaries fall on 1–10 |
| P-04 | Display threshold default (hide ≤1? ≤2? ≤3?) | Phase 3 | User-adjustable regardless |
| P-05 | Within-session freshness model (position multiplier vs. running-fatigue counter) | Phase 4 | |
| P-06 | Fatigue-assignment formula | Phase 4 | |
| P-07 | RP volume landmarks (MEV/MAV/MRV) — include or not | Phase 4 | |
| P-08 | Prescribed next-session loads (auto-fill 6-week ramp, user override) | Phase 5 | |
| P-09 | Tempo as optional logged qualifier | Phase 5 | |
| P-10 | XP formula details (weight × reps × intensity?) + decay model | Phase 6 | |
| P-11 | Native iPhone app | Later | Gym-side logging |
| P-12 | Automatic cloud sync | Later | v1 is manual export |
| P-13 | Eccentric-emphasis contraction refinement | Later | Only if it earns its keep |
| P-15 | Split Erector Spinae + QL out of Abdominals group | Later (optional) | Quirk already neutralized by storing Area_ID on the muscle; only for group tidiness |
| P-16 | Re-evaluate the migrated group-grain 25 with an improved analysis system | **Phase 8** | Now a named phase (muscle-list refinement + full re-analysis), not just "later"; differentiate-or-consolidate the inherited multi-head groups (vasti etc.). |
| P-17 | Exercise variant grouping / inheritance (`Canonical_Exercise_ID` self-reference) | Later | The unfinished "variant inheritance" idea from the handoff doc: let variants (e.g. Incline Bench DB vs BB) share one canonical movement so volume/heatmap math treats them sensibly. Distinct from the dedup rule (D-25). Possibly useful, not needed now. |
| P-18 | Does `muscles.Function` earn its keep? | Phase 4 / 6 | Keep for now (distinct from `Muscle_Role`; the "which stabilizers fatigue?" goal wants it). Confirm a real consumer exists once the fatigue/XP model is built; drop if nothing uses it. |
| P-19 | App-UI palette / brand-color direction | Phase 3 | Keep the Phase-1 clinical "chart-paper" UI palette (paper/slate/oxblood/steel) or re-theme the interior to the LiftPlan brand tokens — aqua `#31D3D0` on ink `#0F172A` (from D-28). Decide alongside the heatmap so the aqua accent and the warm heat-ramp are designed together (cool brand vs. warm data). Launcher/dock icon + `theme-color` are already on-brand; only the interior UI is open. |

---

## 8. Open Questions & Immediate Next Actions

**Phases 0 and 1 are complete (2026-07-10).** The dataset is migrated/validated and the app skeleton is deployed and live on GitHub Pages (repo `liftplan`), installable as a Chrome dock app.

**Immediate next action (Phase 2 — Planning core):** build the program → mesocycle → week template → day → ordered-exercise-list structure and persist it to browser storage (capturing exercise *order* for the later freshness model). *To be started in a new chat within this project* — that chat should read this plan, name the phase explicitly, and note that browser-storage persistence must move from the Phase-1 in-memory/preview stub to real persistent storage on the deployed build (§3 development caveat).

Everything else is either decided (§7.1) or correctly deferred to its build phase (§7.2).

---

## 9. Glossary

- **Mesocycle** — a repeated training week × N weeks + a deload week (per Renaissance Periodization).
- **Macrocycle** — several mesocycles stacked into a longer block.
- **Microcycle** — one week; here, the repeated week template within a mesocycle.
- **Deload** — a lighter recovery week ending a mesocycle.
- **RIR / RPE** — Reps In Reserve / Rate of Perceived Exertion; how many more reps could have been done. The logged effort measure (as in the Strong app).
- **MEV / MAV / MRV** — Minimum Effective / Maximum Adaptive / Maximum Recoverable Volume; per-muscle weekly-volume landmarks (parked, P-07).
- **SFR (stimulus-to-fatigue ratio)** — how much growth stimulus an exercise gives relative to the fatigue it costs.
- **Effective set** — a set that meaningfully contributes stimulus to a target muscle.
- **Propulsion muscle** — primary force producer. **Stability muscle** — controls position / transfers force.
- **Isotonic** — muscle doing dynamic (shortening/lengthening) work. **Isometric** — muscle holding position under load.
- **Inherit-from-group** — assigning intensity at group level and flowing it to each specific head until an exercise justifies differentiating them (§4.5).
- **Inclusive fact table** — one row per genuinely-involved exercise–muscle pair (intensity ≥1); no stored zeros, but all real involvement down to `1` is retained and filtered at display (R4, D-09/R6). *(Earlier framed as "sparse"; the migrated seed is in fact dense and uniform — see §4.2 and D-29.)*
