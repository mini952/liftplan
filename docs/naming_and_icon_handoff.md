# LiftPlan — naming & icon decision (handoff note)

**Date:** 2026-07-10
**Purpose:** A standalone record of the app-name and icon decisions made in a side chat, to be folded into `PROJECT_PLAN.md` later (after the Phase 1 chat's plan edits are saved). **Do not merge two plan copies** — apply the D-28 row below on top of the latest Phase-1 version. This note is the *archive* (the "why" and "what was rejected"); the plan's decision log only needs the terse D-28 line.

---

## Decision summary

- **App name = LiftPlan** — chosen as a *working* name ("for now"), from the shortlist after pressure-testing (availability / logo / how it sounds).
  - Clean as an *exact-string* app name; main downside is a crowded lift-app field, acceptable for a single-user personal app (searchability only).
  - **MesoQuest** reserved as a possible name for the *gamified tracking view* (not the app itself).
  - Revisit only if a stronger name emerges before the GitHub repo is created.

- **Icon = `LP` monogram.**
  - **Type:** Roboto Slab Bold (real font).
  - **Colors:** aqua `#31D3D0` on ink `#0F172A` ("aqua on ink").
  - **Master file:** `liftplan_icon_1024.png` — 1024×1024, rounded tile with transparent corners.
  - A full-square (no rounded corners) variant can be generated later if OS auto-masking is preferred.

---

## Ready-to-paste decision-log row (§7.1 Decided)

```
| D-28 | App name + icon | **LiftPlan** (working choice, "for now"), from the shortlist after pressure-testing (availability / logo / sound). Clean as an exact-string name; crowded lift-app field is the only downside (acceptable for single-user personal use). Icon = Roboto Slab Bold `LP` monogram, aqua `#31D3D0` on ink `#0F172A`; 1024×1024 master with rounded/transparent corners. `MesoQuest` reserved for the gamified tracking view (not the app). Revisit only if a stronger name emerges before the repo is created. | 2026-07-10 |
```

*(When folding in: append after D-27, and bump "Last updated" to the merge date.)*

---

## Brand tokens (for when the app skeleton needs them)

- `--ink`  = `#0F172A`  (background / dark surface)
- `--aqua` = `#31D3D0`  (primary accent / logo)

---

## Full context — how we got here

### Naming journey

1. **Starting point.** Off-the-cuff ideas: "fitness plan and tracker", "MyFitnessPlanner", "FitPlan" — flagged as generic.
2. **Broad brainstorm** (conventional / out-there / creative). Established the app's real **differentiators** to name around: the live **muscle heatmap**, **mesocycle periodization**, and the **XP/gamification** layer.
3. **First shortlist:** FitForge, LiftPlan, MuscleMap, StrengthMap, ProgramFit. Honorable mentions (liked but not the direction): Swole Goal, Gainzilla. **MuscleDex** — liked the Pokédex reference, but "Dex" reads as a *muscle-info/reference* app, not a planner → set aside.
4. **Gamification-forward names** (MuscleXP, GainsRPG, Swole Quest, Grindmap, etc.) were **deliberately set aside** — gamification is a key feature but *not the app's primary identity*, which should lead with fitness planning. **MesoQuest** was liked enough to **reserve for the gamified tracking view**. **Grindmap** rejected ("grind" too edgy).
5. **Leaned toward plain "fit/plan/muscle" planner names.** Added StrengthPlan/StrengthPlanner, then the "Myo-" family (Myo = Greek root for muscle): MyoMap, MyoPlan, plus MusclePlan.
6. **Pressure-test (availability / logo / sound):**
   - **FitForge** — very taken (multiple live apps, incl. one built around XP/gamification). Great sound, worst availability.
   - **MuscleMap** — very taken **and concept-collision** (an existing app uses the same name *and* the muscle-volume heatmap idea). Ruled out despite strong sound/icon.
   - **LiftPlan** — mostly clear as an exact string; sits in a crowded lift-app field. **← chosen.**
   - **StrengthMap** — clear exact string, but "SM" acronym problem + clunky to say.
   - **ProgramFit** — partly taken (a "programFIT" brand exists; also close to the big "Planfit" app).
   - **StrengthPlan / StrengthPlanner** — clear exact string; clunky sound; "Planner" makes a long wordmark.
   - **MusclePlan / MusclePlanner** — no exact match, but a crowded "Muscle— Planner" family (Muscle Monster, Muscle Booster, MuscleFit).
   - **Myo- family** — "Myo" is clean/brandable and sidesteps the crowded fields; MyoMap/MyoPlan were strong runners-up.
7. **Decision:** **LiftPlan**, "for now."

### Icon journey

1. **Concept drafts** generated for MusclePlan, FitForge, LiftPlan, and MyoPlan — mixing monograms, glyphs (dumbbell, flexed bicep, abs, figure, anvil, hammer, flame), and glyph+letter combos.
2. A user-supplied **flexed-arm glyph** was vectorized and applied across names/treatments; noted it's a *very common* fitness silhouette (reads "fitness" clearly but is low on distinctiveness).
3. After choosing **LiftPlan**, generated **10 `LP` monograms** across fonts and color schemes.
4. **Font down-select** (in order of preference): Roboto Slab, Archivo Black (interlocked), Anton, Poppins. Heavier/geometric faces (Anton, Archivo, Oswald) tested strongest at small sizes.
5. **Color:** introduced aqua **`#31D3D0`**, paired with ink **`#0F172A`**; the "aqua on ink" direction was preferred over "ink on aqua."
6. **Final icon:** Roboto Slab Bold `LP`, aqua on ink, 1024×1024 rounded tile.
