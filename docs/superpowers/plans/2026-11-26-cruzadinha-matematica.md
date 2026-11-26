# Cruzadinhas Matemáticas Interconectadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan and review the resulting change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize all 39 published course levels into connected arithmetic crosswords where every missing number participates in horizontal and vertical equations.

**Architecture:** Keep the existing `grid`, `inputIds`, `answerKey`, and `bank` data contract. Author custom 5×5 sparse grids and strengthen catalog validation so each answer cell crosses both equation directions and all equations belong to one connected network. The existing renderer and answer submission flow remain the consumers.

**Tech Stack:** Next.js 16 Pages Router, React 19, JavaScript, JSON course catalog, Jest 30.

**Spec:** `docs/superpowers/specs/2026-11-26-cruzadinha-matematica-design.md`

## Global Constraints

- Every `inputId` participates in at least one horizontal and one vertical equation.
- All equations use the existing five-cell sequence: number, operator, number, equals, number.
- Every answer remains in the level's number bank and every published equation is correct.
- Preserve level IDs, chapters, sessions, and input IDs; keep the existing API and database schema.
- Preserve blank counts: 3 for levels 1–29, 4 for levels 30–38, and 6 for level 39.
- Each level instruction explains that a missing number completes both equations at its crossing.
- Keep answer keys private through the existing `infra/scripts/seed.mjs` filtering.
- Keep generated daily and local puzzles interconnected and deterministic.

---

### Task 1: Publish and validate connected arithmetic crosswords

**Files:**
- Modify: `infra/catalog-validation.mjs`
- Modify: `infra/data/course-catalog.json`
- Modify: `tests/unit/catalog.test.js`
- Modify: `tests/unit/generatePuzzle.test.js`

**Interfaces:**
- `findEquations(grid)` returns each equation with `orientation` (`horizontal` or `vertical`) and its number-cell coordinates.
- `validateCatalog(catalog)` continues returning human-readable error strings; it rejects answer cells that do not cross both directions and equation graphs that are disconnected.
- Catalog levels retain their current metadata and `inputIds`; the existing seed script publishes `grid` and `bank` while keeping `answerKey` private.

- [ ] **Step 1: Write failing topology tests**

In `tests/unit/catalog.test.js`, import `LEVELS` from `lib/game/levels.js`. Build a one-level catalog fixture by copying the metadata from `catalog.levels[0]` and replacing `grid`, `bank`, and answer fields with `LEVELS[0]`; set `inputIds` to `Object.keys(LEVELS[0].answers)` and map `answers` to `answerKey`. Assert the valid fixture has no errors. In a clone, set `grid[1][0]` to `null` and assert the error includes `input a must cross horizontal and vertical equations`. For connectivity, join two copies of the 5×5 grid with one null separator column, rename the second copy's IDs to `e`, `f`, `g`, and `h`, merge the answer keys and input ID lists, and assert the error includes `equations must form one connected crossword`.

In `tests/unit/generatePuzzle.test.js`, normalize each puzzle to one catalog level (`chapter: 1`, `session: 1`, `isBonus: false`, `inputIds: Object.keys(puzzle.answers)`, `answerKey: puzzle.answers`) and assert `validateCatalog` returns no errors for the static `LEVELS`, daily puzzles for a fixed date range, and `generatePuzzle(round)` for rounds 1–12. Give each normalized level valid title, subtitle, emoji, difficulty, XP, bank, and grid fields.

- [ ] **Step 2: Run the focused tests and confirm the intended failures**

Run: `npx jest tests/unit/catalog.test.js tests/unit/generatePuzzle.test.js --runInBand`

Expected: the valid synthetic crossing and the current catalog pass existing checks; the missing-crossing and disconnected fixtures fail because the validator does not yet report those topology errors. Static and generated daily puzzle cases pass their current checks.

- [ ] **Step 3: Extend catalog validation**

Extend `findEquations` so every complete horizontal or vertical equation records its orientation and the coordinates of its number cells at offsets 0, 2, and 4. In `validateLevel`, collect equation orientations for each `inputId` and report any input missing horizontal or vertical coverage. Traverse equations by shared number-cell coordinates; if the traversal cannot reach every equation, report a disconnected crossword. Keep the current arithmetic, bank, metadata, and answer checks unchanged.

- [ ] **Step 4: Redraw all 39 published levels**

Replace independent equation rows in `infra/data/course-catalog.json` with custom 5×5 sparse grids. Use two horizontal plus two vertical equations (four shared number cells) for levels 1–12. For levels 13–29 alternate between two horizontal plus three vertical equations and the transposed three-horizontal plus two-vertical layout (six shared number cells). Use those same alternating layouts for levels 30–38 with four answer cells. Use the two-horizontal plus three-vertical layout for level 39 with all six shared number cells blank. Place each existing `inputId` on a shared number cell and preserve the blank count. Use operations already present in each level; choose values so subtraction stays nonnegative and division is exact. Recalculate equation results, answer keys, and distractors so every answer remains in `bank`. Set each level's instruction to `Preencha os cruzamentos: cada número completa uma conta horizontal e outra vertical.` Increment the catalog content version from `2` to `3`.

- [ ] **Step 5: Run the focused tests**

Run: `npx jest tests/unit/catalog.test.js tests/unit/generatePuzzle.test.js --runInBand`

Expected: all 39 catalog levels, static fallback levels, and deterministic daily puzzles pass topology, connectivity, arithmetic, and bank checks.

- [ ] **Step 6: Check formatting and production build**

Run: `npx prettier --check infra/catalog-validation.mjs infra/data/course-catalog.json tests/unit/catalog.test.js tests/unit/generatePuzzle.test.js docs/superpowers/specs/2026-11-26-cruzadinha-matematica-design.md docs/superpowers/plans/2026-11-26-cruzadinha-matematica.md`

Run: `npm run build`

Expected: formatting and the Next.js production build complete successfully. Confirm the 5×5 custom crosswords fit the existing scrollable board and keep the number bank usable at mobile width.
