# LiftPlan — Workout Planning & Tracking App — Project Plan

**Status:** Living document. This is the working reference for the project inside the Claude project.
**Last updated:** 2026-07-20
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
- **R8 — The repo is the canonical runtime source of truth; fetch on demand.** At the start of each phase-chat, the latest `PROJECT_PLAN.md` and reference files are fetched from their raw GitHub URLs and treated as authoritative over any Claude-project cache. Only the specific file(s) a task actually needs are fetched — not all of them on every message. *(Recorded 2026-07-11: this rule was already in force but previously unwritten — R1 catch-up.)*
- **R9 — Warmups never count.** Warmup sets are excluded from every volume, stimulus, fatigue, heatmap, and XP computation, wherever they appear. A planned prescription is working sets by definition; warmups carry no RIR. (Established by D-35.)
- **R10 — Verify file freshness before trusting a fetch.** Repo fetches can silently return a **stale cached copy** (observed 2026-07-20: the raw GitHub endpoint served a days-old `PROJECT_PLAN.md` even after the commit had landed; a `?cachebust=` query does **not** help, because `raw.githubusercontent.com` ignores query strings in its cache key). So a fetched file is not trusted on its own: (a) every file carries a **version stamp** — the plan's *Last updated* date + highest decision id; data files, a row/record count — and Claude states the stamp it read on fetch; (b) that stamp is **cross-checked** against the last-known state from prior project chats (past-chat search) and, when it matters, against the GitHub **web UI's** latest-commit (the web UI is ground truth); (c) on any mismatch — a fetch older than the known-latest — treat it as **stale** and fall back to a **user upload** of the file (diff to confirm) or a **commit-SHA-pinned** raw URL (content at a SHA is immutable, so it's cache-proof). Never edit a file whose freshness hasn't been confirmed. *(Deeper root-cause fix parked, P-23.)*

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

**Development caveat (already understood):** previews built inside the Claude project cannot use browser storage, so prototypes run on **in-memory** data. The production GitHub Pages build uses persistent browser storage. It's the same code with one storage swap — designed for from the start. *(Phase 2 implements this: `localStorage` on the deployed build, with an automatic in-memory fallback and a "preview — not saving" banner when storage is unavailable.)*

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
- **Sets per muscle / group / area per week** ← join planned/logged **working** sets (R9) to fact rows, roll up.
- **Volume, stimulus, fatigue, SFR, XP** ← formulas TBD (parked, §7).
- **Per-week mesocycle prescriptions (the ramp)** ← derived from the single stored week template + working-week count + deload flag (D-30); the week-to-week load/rep/set progression and RIR taper are computed, not stored (P-08, Phase 5).

### 4.5 The inherit-from-group rule (granularity)

The canonical muscle list keeps **all specific muscles** (all four vasti, all pec/triceps heads, etc.). But an analysis may assign intensity at the **group** level and let it flow down to every head of that group, tagged `Intensity_Source = Group`. A head is only broken out with its own value (`Intensity_Source = Specific`) when a specific exercise genuinely biases it.

**Expected consequence:** early on, the Specific-Muscle heatmap and the Group heatmap will often look identical, because most values are inherited. The Specific view becomes more informative only as heads are deliberately differentiated over time. This is correct behavior, not a bug.

### 4.6 Personal-data JSON

The **root container and the program → mesocycle → week-template → day → exercise shape are frozen** (D-30–D-34, D-36) and implemented in Phase 2. The logged-sessions and XP shapes further down remain v1 sketches; fields tied to parked formulas (XP, fatigue) firm up in Phases 5–6.

```jsonc
// personal-data root (D-33) — the ENTIRE object is what export / import reads and writes
{
  "version": 1,                   // format-version integer, for forward-migration
  "activeProgramId": "prog_01",   // exactly one active program (D-32)
  "programs": [                   // a *library* of named programs (D-32)
    {
      "id": "prog_01",            // a Program == the macrocycle (D-36): an ordered set of mesocycles
      "name": "Winter Block",
      "createdAt": "2026-07-10",
      "mesocycles": [{
        "id": "meso_01",
        "name": "Hypertrophy A",
        "weeks": 6,               // working weeks
        "deload": true,           // adds one *derived* deload week (D-30)
        "microcycle": {           // ONE week template, stored once; weeks 2..N + deload are DERIVED (D-30, R3)
          "days": [{
            "id": "day_push_a",
            "name": "Push A",
            "exercises": [        // ORDER = array position (D-31); no stored `order` field (R3)
              {
                "exerciseId": "EX0017",
                "sets": 3,          // WORKING sets (warmups never counted — R9)
                "repRangeLow": 8,
                "repRangeHigh": 12,
                "targetRIR": 2      // week-1 STARTING RIR (D-34); taper toward 0 derived in Phase 5 (P-08)
              }
            ]
          }]
        }
      }]
    }
  ],
  "sessions": [],                 // reserved: Phase 5 logging (sketch below)
  "xp": { "byMuscle": {} }        // reserved: Phase 6 (sketch below)
}
```

```jsonc
// logged sessions (what actually happened) — v1 SKETCH, firms up in Phase 5
{
  "sessions": [{
    "id": "sess_2026_07_09",
    "date": "2026-07-09",
    "mesocycleId": "meso_01",
    "weekNumber": 1,
    "dayId": "day_push_a",
    "entries": [{                 // order = array position, per D-31
      "exerciseId": "EX0017",
      "sets": [                   // per-set warmup/working flag lands here (P-21); warmups excluded from counting (R9)
        { "set": 1, "weight": 60, "reps": 8, "rir": 3 },
        { "set": 2, "weight": 60, "reps": 8, "rir": 2 }
      ]
    }]
  }]
}
```

```jsonc
// XP state (per specific muscle; group/area rolled up in app) — v1 SKETCH, firms up in Phase 6
{
  "byMuscle": {
    "MU0048": { "xp": 12, "history": [ { "date": "2026-07-09", "delta": 3, "reason": "Push A" } ] }
  }
}
```

Logged per set (from the Strong-app pattern): **weight, reps, RIR** — RIR is the single stored effort metric (D-34; RPE is derivable as `10 − RIR`, display-only). Rest is optional/likely unused; **tempo** is a possible optional qualifier (parked, P-09).

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

**Phase 2 — Planning core. ✓ Complete (2026-07-11).**
Build a program → mesocycle → week template → day → ordered exercise list. Persist to browser storage. Exercise *order* is captured (feeds the freshness model later). *Deliverable:* can construct and save a plan.
*Shipped:* a **Plan** view (now the app's landing tab) with a program **library** bar (D-32), a mesocycle outline, and a week-template editor. Mesocycles store one week template + working-week count + deload flag (D-30); day cards hold ordered exercises (order = array position, D-31) with the baseline prescription — working sets, rep range, week-1 target RIR (D-31, D-34) — reorderable via ▲▼, plus a searchable/filterable exercise picker reading the live exercise data. All personal data lives in the versioned root `{ version, activeProgramId, programs[] }` (D-33), saved to `localStorage` on every edit with an in-memory fallback + "preview — not saving" notice for Claude-project previews (§3 caveat); real JSON export/import operates on the whole root and auto-migrates the Phase-1 stub shape. **Validated** via a 30-assertion headless harness (boot/migration, library, meso/day/exercise CRUD, prescription clamping, array-position reorder, weeks/deload edits, legacy-shape migration, `localStorage` round-trip + restore + delete) plus a manual checklist (create/edit/reload/export–import round-trip, full live exercise list, dock shortcut). UI refinements from testing: widened prescription inputs (spinners removed) so multi-digit values aren't clipped, and a fixed-top/fixed-height picker so filtering doesn't resize or shift it. **Planning-UI enhancements deliberately parked as P-20** (supersets, program/mesocycle detail panel, minimal warmup representation).

**Phase 3 — Muscle heatmap (top priority). ✓ Complete (2026-07-20).**
Body diagram with the 9 general areas; switch between Area / Group granularity; adjustable involvement floor (R6). *Resolved this phase:* the diagram substrate — 9 areas, front + back schematic figure, one silhouette driving both grains via `data-group`/`data-area` (D-37, resolves P-02); original schematic artwork as a **swappable skin** (D-38); the 5 fully-deep groups as ghosted chips (D-39); the **shading metric** — intensity-weighted default, set-count **role-gated** to Primary+Secondary, count-once roll-ups, validated against the real fact table (D-40, resolves P-01); the **involvement floor** default (ignore intensity ≤2) with relative heat-normalization for MVP (D-41, resolves P-04); the **UI palette** — aqua accent, warm ramp reserved for data (D-42, resolves P-19); and, on live review, a **Plan-view layout restructure** (D-43), the **compact/expand-in-place + per-day map presentation model** (D-44), and a derived **"not analyzed" indicator** (D-45). *Shipped:* front + back figure painting live from the active mesocycle's week template, Area/Group toggle (Area fades internal borders to read as regions), intensity/set-count toggle, involvement-floor slider, deep-group chips, per-zone side-list, a compact weekly map above the week template that expands in place, a per-day workout map on every day card, and the aqua re-theme — all wired to the engine validated headlessly against the real embedded data (density + roll-up + floor assertions passing) and to a 19-check integration harness. **Deferred by decision:** Specific-muscle granularity → Phase 8 (D-37; additive subdivision of this same figure, no substrate change); absolute heat bands + High/Mod/Low labels → Phase 5 (P-03); figure visual polish → P-22. *Deliverable:* the visual imbalance view during planning — delivered. *Next:* Phase 4 (volume & stimulus analysis).

**Phase 4 — Volume & stimulus analysis.**
Sets-per-muscle-per-week roll-ups; imbalance/under-/over-training flags; the **within-session freshness model** (first exercise = freshest). *Resolves:* freshness rule (position multiplier vs. running-fatigue counter) and fatigue-assignment formula. *Optionally introduces* RP volume landmarks (MEV/MAV/MRV) if wanted. *Deliverable:* objective per-week volume analysis.

**Phase 5 — Tracking & logging.**
Log weight / reps / RIR per set against the plan; progression charts across the mesocycle; plan-vs-actual comparison. *Resolves:* whether the planner *prescribes* next-session loads (the ramp auto-fill that the user can override, P-08); tempo as optional qualifier (P-09); **per-set warmup vs. working marking** (P-21). *Deliverable:* the tracking experience.

**Phase 6 — XP & gamification.**
XP engine (leaning weight × reps × intensity), tracked per specific muscle and rolled up to group/area; **decay** tracked separately and summed (e.g. +4 over weeks, −1 for a week off); **projected XP as a range** built from planned ramp assumptions, shown during planning. *Resolves:* the XP formula and decay model. *Deliverable:* progress gamification + projected-gain preview.

**Phase 7 — AI data-maintenance workflow.**
A reusable, drift-resistant prompt + the 5-domain **coverage checklist** (below) for analyzing a new exercise into specific-grain fact rows; a validation pass (§5.2) on every addition. *Deliverable:* a repeatable "add a new exercise" pipeline that keeps the dataset consistent.

**Phase 8 — Muscle-list refinement + full re-analysis (post-MVP).**
The migrated seed is group-grain and carries several migration-era placeholders; this phase makes them real, using the Phase 7 workflow. Two parts:
1. **Muscle-list refinement.** Split Rectus Abdominis → Upper / Lower (D-27, same regional convention as the obliques). Review `Function` assignments (incl. the P-18 "does it earn its keep" call, and Iliacus/Psoas). For each multi-head group currently inheriting one value (the four vasti are the prime case, also the glutes, hamstrings, traps, pec-major heads), **either differentiate the heads with head-specific scores or consciously consolidate** them if they never meaningfully diverge for these exercises — turning §4.5 placeholders into decisions.
2. **Full re-analysis.** Re-run every exercise through the Phase 7 coverage-checklist at specific grain. This overwrites the group-grain seed *and* the Phase-0 migration judgment calls that were only ever provisional — the extensor-compartment fold (max-of-two), the oblique Upper/Lower direction, and every `Intensity_Source = Group` row. *Resolves:* **P-16**. *Deliverable:* a fully specific-grain, re-scored fact table.

**Planning-enhancements pass (post-MVP, slot TBD — P-20).** Supersets, the program/mesocycle detail panel (focus + dates + description), and minimal warmup representation. Grouped as one coherent pass rather than piecemeal; exact placement in the roadmap to be assigned when the core loop (Phases 3–6) is closer to done.

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
| D-30 | Mesocycle structure model | Store **one week template** (the microcycle) once + a working-week count (`weeks`) + a `deload` flag; weeks 2..N and the deload week are **derived, not stored** (R3). The cross-week ramp (load/rep/set progression + RIR taper) is layered on in Phase 5 (P-08). E.g. `weeks:6, deload:true` = 6 working + 1 derived deload = 7 total. | 2026-07-10 |
| D-31 | Phase-2 prescription grain | Each exercise entry stores `exerciseId` + a baseline prescription: **working**-set count (`sets`), rep range (`repRangeLow`/`repRangeHigh`), and `targetRIR`. Exercise **order = array position** — no stored `order` field (R3). Baseline = the week-1 anchor for the Phase-5 ramp; the set count feeds the Phase-3 heatmap set-count metric (P-01). | 2026-07-10 |
| D-32 | Program library | Personal data holds a **library** of named programs (not a single program); exactly one is active via `activeProgramId`. | 2026-07-10 |
| D-33 | Versioned personal-data root | All personal data lives in one top-level object `{ version, activeProgramId, programs[] }`, plus reserved `sessions[]` (Phase 5) and `xp.byMuscle` (Phase 6). `version` is a format-version integer for forward-migration. **Export/import operates on the whole object** (replaces the Phase-1 stub; auto-migrates the old `schemaVersion` shape). | 2026-07-10 |
| D-34 | Planned effort metric = RIR | **RIR is the single stored planned-effort value.** RPE is derivable (`RPE ≈ 10 − RIR`) and display-only if ever surfaced — never stored (avoids dual-metric drift; RP is RIR-native). Per-exercise `targetRIR` is the **week-1 starting** target; the taper toward 0 across the block is derived by the Phase-5 ramp (P-08), where the primary week-to-week lever is added volume (sets) with RIR concurrently lowering to near-failure by the last working week. | 2026-07-11 |
| D-35 | Warmup exclusion | **Warmups never count** toward volume, stimulus, fatigue, the heatmap, or XP — anywhere they appear (Rule **R9**). A planned prescription is working sets by definition; warmups carry no RIR. Warmup *representation* in the planner (a minimal per-exercise `warmupSets` count, no RIR, never counted) is parked to the planning-enhancements cluster (P-20); per-set warmup/working marking at **log** time is a Phase-5 concern (P-21). | 2026-07-11 |
| D-36 | Program = macrocycle (no new nesting) | A **Program is the top planning container and serves as the macrocycle** (an ordered sequence of mesocycles); no separate Macrocycle entity is introduced (R3 — don't add a layer that isn't earning its keep for a solo lifter). Block/phase intent (base / hypertrophy / strength / peak / …) is expressed via a per-mesocycle **`focus`** field (parked, P-20), not a new hierarchy level. Revisit only if multiple *named* macrocycles within one program are ever needed. | 2026-07-11 |
| D-37 | Heatmap substrate & P-02 resolution | **9-area rendering; front + back schematic figure.** Built at **Area (9) + Group (22)** grain on one silhouette where every zone carries both `data-group` and `data-area`, so a single figure drives both views. **Specific-muscle grain is deferred to Phase 8** — the group-grain seed makes a Specific view a near-copy of the Group view until the re-analysis differentiates heads; it is a purely additive subdivision of this same figure when the data justifies it, with no substrate change. "Lower back" area label kept as-is. Resolves **P-02**. | 2026-07-12 |
| D-38 | Muscle-map asset = original schematic SVG | **Hand-authored original artwork** — not derived from any third-party asset, so no external license and no attribution; LiftPlan owns it. Candidate open-licensed assets were evaluated and set aside (react-muscle-highlighter too coarse for the group grain; body-muscles license unconfirmed). The figure is a **swappable skin**: the shading engine keys off path ids, the `m-group-*`/`m-area-*` classes, and `data-group`/`data-area` — **never path geometry** — so a higher-fidelity figure can be dropped in later without touching the engine (see P-22). | 2026-07-12 |
| D-39 | Deep groups rendered as chips | The 5 fully-deep groups — Hip Flexor (`MG0008`), Rhomboids (`MG0012`), Levator Scapulae (`MG0013`), Subclavius (`MG0018`), Brachialis (`MG0021`) — are **not drawn on the body**; they render as ghosted, heat-tinted, dashed chips in a side list (the locked deep treatment). They still receive computed heat values; only their rendering differs. The app derives them as "groups with no `data-group` body zone." The muscle-level deep structures raised earlier (subscapularis, TVA) fold into Phase 8 alongside Specific grain. | 2026-07-12 |
| D-40 | Heatmap shading metric (P-01 resolution) | **Both metrics ship as a toggle; intensity-weighted is the default.** Validated against the real fact table (25 exercises × exactly 50 muscles, 84% Stabilizer, 74% of rows ≤ intensity 3): a raw/floored **set-count washes out** (abs and forearms outrank chest on a push day) while **intensity-weighting self-normalizes** against the dense stabilizer background. The **set-count metric is gated by role (Primary + Secondary only)** — not by the intensity floor — so "sets per muscle" matches the RP sense. Roll-ups **count each group/area once per exercise** (intensity metric = working sets × the max head-intensity for that exercise/group; set-count = the exercise's working sets added once). Muscle-grain values are still computed for the side-list even though Specific body-rendering is deferred (D-37). Resolves **P-01**. | 2026-07-12 |
| D-41 | Involvement floor & heat mapping (P-04 resolution) | The intensity metric applies an adjustable **involvement floor**, default **ignore intensity ≤ 2** (user-adjustable; a higher floor gives a prime-movers-only read). Heat maps to the warm ramp by **relative normalization** (hottest zone in view = ramp top) for the MVP; **absolute set-landmark bands + the High/Moderate/Low labels are deferred to Phase 5** with the effort/RIR calibration (P-03). Note: the current seed contains **no intensity-10 rows**, so the ramp top is reached at 9 until the Phase-8 re-analysis. Resolves **P-04**. | 2026-07-12 |
| D-42 | UI palette (P-19 resolution) | Re-theme the interior to the LiftPlan brand: **aqua `#31D3D0` becomes the UI accent** (active nav, selected/interactive states), with a deepened aqua `#0E9C99` for aqua text/links on light surfaces; cool neutral chrome retained. The **warm heat-ramp (pale amber → oxblood `#A83626`) is reserved exclusively for heatmap data**, which frees oxblood from its Phase-1 double-duty as the UI highlight (the exact collision P-19 flagged). Cool chrome + warm data keeps the heatmap the only warm thing on screen. Resolves **P-19**. | 2026-07-12 |
| D-43 | Plan-view layout restructure | Mesocycles promoted to a **full-width bar under Programs** (mirrors the Programs bar; selected meso is aqua-filled, active program stays ink-filled); the left outline column is dissolved; program rename/delete move to a slim meta row; the mesocycle editor runs full-width. Makes it clear the selected mesocycle drives everything below it, and gives the heatmap/maps the width they need. | 2026-07-20 |
| D-44 | Heatmap presentation model | The weekly muscle map sits at the **top of the mesocycle** (above the week template) in a **compact** form — small front+back figure + a "hottest: …" summary line + a tiny sub-list — with **Expand-in-place** unfolding the full controls (Group/Area, Intensity/Set-count, floor slider), side-list, and deep-group chips (one figure, two states, no duplicate). Each **day card** carries its own small **workout map** painted from that day's exercises. **Compact and per-day maps are fixed at glance defaults (Group, intensity-weighted, floor 2); only the expanded weekly map is interactive**, so the small maps stay predictable. In **Area** grain, internal group borders fade so same-area zones read as the 9 regions. | 2026-07-20 |
| D-45 | "Not analyzed" indicator | Exercises with **no `exercise_muscle` rows** are flagged "· not analyzed" (same muted style as the rest of the row) in the exercise picker and on day-card rows, with an aggregate note on the weekly map ("N not yet analyzed — not shown"). **Derived live from the fact table — no data-file change** (an exercise is "analyzed" iff it has fact rows). Currently **25 of 62** exercises are analyzed; the flag stays useful as new exercises are added (unanalyzed until the Phase 7/8 pipeline processes them). | 2026-07-20 |

### 7.2 Parked (decide in the noted phase)

| # | Open decision | Resolve in | Notes |
|---|---|---|---|
| ~~P-01~~ | ~~Heatmap shading metric (set-count vs. intensity)~~ | ✓ **Resolved (Phase 3) → D-40** | Both metrics as a toggle; intensity-weighted default; set-count role-gated (Primary+Secondary). |
| ~~P-02~~ | ~~6-vs-9 diagram rendering~~ | ✓ **Resolved (Phase 3) → D-37** | 9 zones, front + back; "Lower back" label kept. |
| P-03 | Intensity text-label cutoffs (which values → which labels) + absolute heat bands | Phase 5 | Where High/Moderate/Low fall on 1–10, and the absolute set-landmark bands. MVP heatmap ships with **relative normalization** (D-41) pending this calibration. |
| ~~P-04~~ | ~~Display threshold default (hide ≤1? ≤2? ≤3?)~~ | ✓ **Resolved (Phase 3) → D-41** | Involvement floor default ignore ≤2; user-adjustable. |
| P-05 | Within-session freshness model (position multiplier vs. running-fatigue counter) | Phase 4 | |
| P-06 | Fatigue-assignment formula | Phase 4 | |
| P-07 | RP volume landmarks (MEV/MAV/MRV) — include or not | Phase 4 | |
| P-08 | Prescribed next-session loads (auto-fill ramp, user override) | Phase 5 | The derived week-to-week progression: set/volume ramp + RIR taper from the D-30 week-1 template |
| P-09 | Tempo as optional logged qualifier | Phase 5 | |
| P-10 | XP formula details (weight × reps × intensity?) + decay model | Phase 6 | |
| P-11 | Native iPhone app | Later | Gym-side logging |
| P-12 | Automatic cloud sync | Later | v1 is manual export |
| P-13 | Eccentric-emphasis contraction refinement | Later | Only if it earns its keep |
| P-15 | Split Erector Spinae + QL out of Abdominals group | Later (optional) | Quirk already neutralized by storing Area_ID on the muscle; only for group tidiness |
| P-16 | Re-evaluate the migrated group-grain 25 with an improved analysis system | **Phase 8** | Now a named phase (muscle-list refinement + full re-analysis), not just "later"; differentiate-or-consolidate the inherited multi-head groups (vasti etc.). |
| P-17 | Exercise variant grouping / inheritance (`Canonical_Exercise_ID` self-reference) | Later | The unfinished "variant inheritance" idea from the handoff doc: let variants (e.g. Incline Bench DB vs BB) share one canonical movement so volume/heatmap math treats them sensibly. Distinct from the dedup rule (D-25). Possibly useful, not needed now. |
| P-18 | Does `muscles.Function` earn its keep? | Phase 4 / 6 | Keep for now (distinct from `Muscle_Role`; the "which stabilizers fatigue?" goal wants it). Confirm a real consumer exists once the fatigue/XP model is built; drop if nothing uses it. |
| ~~P-19~~ | ~~App-UI palette / brand-color direction~~ | ✓ **Resolved (Phase 3) → D-42** | Aqua `#31D3D0` accent (+ `#0E9C99` for text); warm ramp reserved for data. |
| P-20 | Planning-enhancements cluster | Post-MVP (slot TBD) | One coherent pass, not piecemeal: **(a) supersets** — a lightweight `supersetGroup` tag on exercise entries; adjacent same-tag entries form a rotation; order stays array position (D-31). **(b) Program/mesocycle detail panel** — per-mesocycle `focus` enum (Base / Hypertrophy / Strength / Peak / Maintenance / Mobility — finalize at build; carries the D-36 block intent), optional mesocycle `startDate` (end derived from weeks + deload), optional program `description`. **(c) Minimal warmup representation** — optional per-exercise `warmupSets` count, no RIR, excluded from all counting (R9). Slotted after the core loop (Phases 3–6) is closer to done. |
| P-21 | Per-set warmup vs. working annotation (log-time) | Phase 5 | Strong-style per-set flag captured when logging a session (not planned set-by-set). Distinct from P-20(c) (planned warmups). Warmups excluded from counting (R9). |
| P-22 | Heatmap figure visual polish | Post-MVP (slot TBD) | Upgrade the schematic figure to illustration-grade — via a licensed anatomical asset (confirm license + extract/remap to the D-38 contract) or further hand passes. **Pure cosmetic swap through the D-38 addressing contract; does not touch the shading engine.** Not a blocker; the schematic ships now. |
| P-23 | Robust repo-fetch freshness (deeper fix) | Later | R10 gives the operational workaround (report the version stamp, cross-check web UI / past chats, fall back to upload or SHA-pin). Still open: the *root-cause* fix so on-demand fetch is trustworthy without manual steps — e.g. why the raw-fetch cache stays stuck (fetch-layer vs GitHub CDN), a SHA-pin helper, a GitHub-API contents/commits freshness probe, or an in-repo `VERSION`/build-stamp marker Claude can cross-check automatically. Investigate when it's worth the time; R10 covers us until then. |

---

## 8. Open Questions & Immediate Next Actions

**Phases 0, 1, 2, and 3 are complete.** The dataset is migrated/validated; the app skeleton is deployed and live on GitHub Pages (repo `liftplan`), installable as a Chrome dock app; the **planning core** (program → mesocycle → week template → day → ordered exercises) is built, persisted to browser storage, export/importable, and validated; and the **muscle heatmap** — the live imbalance view during planning (Area/Group, intensity/set-count, involvement floor, deep-group chips, compact/expand weekly map, per-day workout maps, aqua re-theme, and a derived "not analyzed" flag) — is built, validated, and shipped.

**Immediate next action (Phase 4 — Volume & stimulus analysis):** build sets-per-muscle-per-week roll-ups and imbalance / under- / over-training flags on top of the Phase-3 engine (the count-once group/area roll-ups and the working-set join already exist, R9); add the **within-session freshness model** (first exercise = freshest), resolving the freshness rule (position multiplier vs. running-fatigue counter, P-05) and the fatigue-assignment formula (P-06); optionally introduce RP volume landmarks MEV/MAV/MRV (P-07). *To be started in a new chat within this project* — that chat should first confirm it's working with the current `PROJECT_PLAN.md` and any reference files it needs (R8 + **R10**: report the version stamp, cross-check, and upload/SHA-pin if the fetch looks stale), then name the phase explicitly.

Everything else is either decided (§7.1) or correctly deferred to its build phase (§7.2).

---

## 9. Glossary

- **Mesocycle** — a repeated training week × N weeks + a deload week (per Renaissance Periodization).
- **Macrocycle** — several mesocycles stacked into a longer block; in LiftPlan a **Program** *is* the macrocycle (D-36).
- **Microcycle** — one week; here, the repeated week template within a mesocycle (stored once; other weeks derived, D-30).
- **Deload** — a lighter recovery week ending a mesocycle.
- **RIR / RPE** — Reps In Reserve / Rate of Perceived Exertion; how many more reps could have been done (`RPE ≈ 10 − RIR`). **RIR is the stored planning + logging effort metric** (D-34); RPE is derivable and display-only.
- **Working set vs. warmup** — only **working** sets count toward volume / stimulus / fatigue / heatmap / XP (R9). Warmups are prep, carry no RIR, and are never counted.
- **MEV / MAV / MRV** — Minimum Effective / Maximum Adaptive / Maximum Recoverable Volume; per-muscle weekly-volume landmarks (parked, P-07).
- **SFR (stimulus-to-fatigue ratio)** — how much growth stimulus an exercise gives relative to the fatigue it costs.
- **Effective set** — a set that meaningfully contributes stimulus to a target muscle.
- **Propulsion muscle** — primary force producer. **Stability muscle** — controls position / transfers force.
- **Isotonic** — muscle doing dynamic (shortening/lengthening) work. **Isometric** — muscle holding position under load.
- **Inherit-from-group** — assigning intensity at group level and flowing it to each specific head until an exercise justifies differentiating them (§4.5).
- **Inclusive fact table** — one row per genuinely-involved exercise–muscle pair (intensity ≥1); no stored zeros, but all real involvement down to `1` is retained and filtered at display (R4, D-09/R6). *(Earlier framed as "sparse"; the migrated seed is in fact dense and uniform — see §4.2 and D-29.)*
