```markdown
> **Instruction for the new chat:** You are joining this project mid-stream. Treat the decisions below as finalized unless there is a compelling technical reason to revisit them. Do **not** re-derive or redesign the architecture; continue building from the established system.

---

# Exercise Programming Database Project - Context Handoff

## 1. What we're working on and the current goal

The project is building a relational Google Sheets database for analyzing strength-training exercises and using that data to plan and analyze workout programs.

The long-term objective is to create a system that can answer questions such as:

- How many effective sets does each muscle receive per week?
- How much volume does each muscle group receive?
- Which muscles are over- or under-trained?
- What movement patterns are underrepresented?
- Which stabilizers are accumulating fatigue?
- Compare different workout programs objectively.

The database is designed from first principles rather than copying existing exercise databases.

The current task is populating the **Exercise Muscle Database2** by analyzing each exercise and assigning:

- Muscle Role
- Intensity Level
- Intensity Value (1–10)
- Contraction Type
- Notes

using a consistent methodology.

---

# 2. Current state

Three foundational databases now exist.

## Database 1: Exercise Database2

One row per exercise.

Contains (among other fields):

- Exercise_ID (stable key)
- Exercise Name
- Exercise Category
- Equipment
- Movement Type
- etc.

Exercise_ID is the canonical identifier.

Exercise names are display labels only.

---

## Database 2: Muscle Database

One row per specific muscle.

Contains:

- Muscle_ID
- Specific Muscle
- Muscle Group
- General Area
- Muscle Function

Muscle Function has already been assigned.

Allowed values:

- Propulsion
- Stability

Examples:

Glute Max = Propulsion

Glute Med = Stability

Rectus Abdominis = Stability

Lats = Propulsion

Rotator cuff = Stability

Forearm Flexors = Stability

---

## Database 3: Exercise Muscle Database2

Fact table.

One row = one meaningful relationship between an exercise and a muscle.

Columns:

Exercise_ID

Muscle_ID

Muscle_Role

Intensity_Level

Intensity_Value

Contraction_Type

Notes

Exercise and Muscle names are looked up automatically from IDs.

They are NOT stored as keys.

---

Currently populating this table exercise-by-exercise.

---

# 3. Key decisions (finalized)

## Use stable IDs everywhere

Exercise_ID and Muscle_ID are the canonical identifiers.

Never join on text.

Reason:

Exercise names may change.

IDs never change.

---

## Sparse fact table

Store ONLY meaningful exercise-muscle relationships.

No rows for muscles that are not meaningfully involved.

Reason:

Sparse fact tables scale.

Dense matrices become mostly noise.

---

## No zero rows

Do NOT create rows with:

Intensity = 0

Role = None

etc.

Absence of a row means:

"This muscle is not meaningfully involved."

Reason:

Keeps the fact table clean.

Matches relational database best practices.

---

## Muscle Function belongs in Muscle Database

Not Exercise Muscle Database.

Reason:

Muscle Function is an inherent property of the muscle.

Not the exercise.

Allowed values:

Propulsion

Stability

---

## Intensity represents TRAINING STRESS

NOT EMG.

NOT anatomical activation.

Definition:

Intensity_Value represents how much this muscle meaningfully contributes to training stress and fatigue accumulation during a typical working set.

---

## Stabilizers are scored by fatigue, not movement

Important rule.

Isometric muscles are NOT automatically low intensity.

Example:

Forearms during heavy deadlifts:

High

Rectus abdominis during heavy squats:

Moderate-High

TVA during pullups:

Moderate

---

## Exercise names are looked up

Exercise Muscle Database stores only IDs.

Exercise names are populated via XLOOKUP.

---

# 4. What we considered and ruled out

## Dense matrix (53 muscles × every exercise)

Rejected.

Reason:

Creates thousands of meaningless rows.

Makes analysis harder.

Produces noisy data.

---

## Delete zero rows later

Rejected.

Reason:

Still requires entering thousands of meaningless rows.

Introduces subjective cleanup.

---

## Join using exercise names

Rejected.

Reason:

Names change.

IDs don't.

---

## Overly detailed anatomy

Rejected.

Examples:

Tiny stabilizers

Microscopic subdivisions

Reason:

No programming benefit.

---

# 5. Frameworks / methodologies / schemas developed

## Exercise Muscle Database schema

Columns:

Exercise_ID

Muscle_ID

Muscle_Role

Intensity_Level

Intensity_Value

Contraction_Type

Notes

---

## Muscle Role

Allowed values:

Primary

Secondary

Stabilizer

Definitions:

Primary

Primary driver of movement.

Secondary

Meaningfully assists movement.

Stabilizer

Controls position or transfers force.

---

## Intensity Level

Allowed values:

Low

Moderate

High

---

## Intensity Value anchors

### High (7–10)

Muscle limits:

load

reps

technique

or accumulates significant fatigue.

Examples:

Glute max in deadlift

Lats in pullup

Forearms in heavy deadlift

---

### Moderate (4–6)

Meaningful contributor.

Not limiting.

Examples:

Obliques

Posterior deltoid

Trap

---

### Low (1–3)

Present but minimally important.

Usually omit entirely from sparse database.

---

## Contraction Type

Allowed values:

Concentric

Eccentric

Isometric

Mixed

---

## Exercise Analysis Template

Temporary worksheet.

Columns:

Exercise_ID

Exercise

Muscle_ID

Specific Muscle

Muscle Group

General Area

Muscle Function

Muscle Role

Intensity Level

Intensity Value

Contraction Type

Notes

Purpose:

Analyze one exercise at a time.

Copy finished rows into Exercise Muscle Database2.

Clear.

Repeat.

---

## Coverage Checklist (FINAL)

Every exercise MUST explicitly evaluate these five domains.

### Domain 1 — Primary Movers

Question:

Which muscles directly produce the movement?

---

### Domain 2 — Major Synergists

Question:

Which muscles materially assist the movement?

---

### Domain 3 — Joint & Segment Controllers

Question:

Which muscles control:

scapula

hip

shoulder

knee

Examples:

Rhomboids

Middle trap

Lower trap

Glute med

Rotator cuff

---

### Domain 4 — Core & Anti-Movement Demand

Question:

Does the exercise require:

anti-extension

anti-rotation

anti-lateral flexion

bracing

Explicitly evaluate:

Rectus Abdominis

External Oblique

Internal Oblique

TVA

QL

---

### Domain 5 — Distal Limiters

Question:

Is performance limited by:

grip

foot stability

ankle stability

Evaluate:

Forearms

Tibialis

Peroneals

Calves

---

Mandatory final check:

For every omitted muscle ask:

1. Would fatigue here reduce performance?

2. Does this muscle accumulate meaningful fatigue?

3. Would omitting it distort programming analysis?

If YES to any:

Include it.

---

# 6. Key terminology

## Sparse fact table

Store only meaningful relationships.

---

## Coverage checklist

Five-domain review process preventing muscle omissions.

---

## Intensity

Programming stress.

NOT activation.

---

## Propulsion muscle

Primary force-producing muscle.

---

## Stability muscle

Primarily responsible for control, positioning or force transfer.

---

## Canonical exercise

Reference version used for comparing variants.

Example:

Pull-up

Variants should add or modify muscles/intensity.

Not silently remove important muscles.

---

# 7. Constraints, assumptions, and preferences

The user values:

Consistency over speed.

Repeatability over intuition.

Database normalization.

First-principles design.

Professional-quality architecture.

The user prefers:

Stable IDs

Explicit frameworks

Objective heuristics

Minimal manual cleanup later.

Google Sheets is the implementation platform.

---

# 8. Open questions and pending next steps

Highest priority:

Improve AI prompt quality so exercise analyses are consistent.

Specifically:

Prevent missing muscles.

Prevent intensity drift.

Prevent differences like:

Pull-up

vs

Pull-up (Stomach to Bar)

where one analysis contained only four muscles and another contained ten.

Need to formalize:

Canonical movement patterns.

Variant inheritance.

Quality assurance workflow.

Possible future work:

Versioning

Confidence scores

Automated QA

Program analysis dashboards

Volume calculations

Fatigue calculations

---

# 9. Do Not Lose

One major insight discovered:

The problem is NOT sparse vs dense databases.

The problem is inconsistent coverage.

Sparse fact tables remain the correct architecture.

The solution is:

Coverage Checklist

+

Intensity Anchors

+

Consistent review process.

Another important insight:

Variants of an exercise should generally:

inherit muscles from the canonical movement

then:

increase/decrease intensity

or

add muscles

but should almost never silently remove muscles.

Example:

A standard Pull-up should establish the baseline.

Stomach-to-bar Pull-up should extend that baseline.

Not replace it.

This "variant inheritance" concept has not yet been fully formalized and is an important next design step.

---

# 10. Recommended first prompt for the next chat

> I want to continue building my Exercise Programming Database. Please treat the attached context as the current project state. Do not redesign the database architecture. Instead, help me formalize a **canonical movement inheritance system**, where each base exercise (e.g., Pull-up, Bench Press, Back Squat, Deadlift) defines a baseline muscle profile, and exercise variants inherit that profile while only adding, removing, or modifying muscles and intensities when biomechanically justified. I want a reusable framework that improves consistency across all future exercise analyses.
```
