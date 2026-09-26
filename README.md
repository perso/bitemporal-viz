# bitemporal-viz

A browser tool for looking at bitemporal tables side by side. Load your source tables and
their join as CSVs, and every key's versions appear on one valid-time axis.

Try it at <https://perso.github.io/bitemporal-viz/> — click **Load sample** for the demo
data. Every push to `main` redeploys it. To run it locally:

```bash
npm install
npm run dev        # http://localhost:5173 — click "Load sample" to see the demo data
```

## Input

One CSV per table, named after the entity it holds:

```csv
# student.csv
student_id,major,valid_from,valid_to,transaction_start,transaction_end
101,Biology,2025-09-01,9999-12-31,2025-09-01,2026-03-01
101,Biology,2025-09-01,2026-01-01,2026-03-01,9999-12-31
101,CS,2026-01-01,9999-12-31,2026-03-01,9999-12-31
```

| Column | Rule |
|---|---|
| `valid_from` `valid_to` `tech_valid_from` `tech_valid_to` | Required. Names listed in [`src/config/columns.json`](src/config/columns.json) are picked up automatically; for any other names the app asks you to pick the four columns once and remembers the choice. Click a table's chip in the legend to change it later. A blank value, `null` or year 9999 means an open end. Times without an offset are read as UTC. |
| `<entity>_id` | Links the row to an entity. By default the column name must equal the entity, or start or end with it: `student_id` and `tutor_student_id` both point to `student.csv`. For other names, click the table's chip in the legend and pick its key and what each column links to, e.g. key `id` in `pupils.csv`, and `learner_id` links to `student`. The choice is remembered. |
| everything else | Descriptive. The first two such values label the bar, and the tooltip shows them all. |

A table whose own id is present (`student_id` in `student.csv`) gets one lane per id.
A table without one, like `grade.csv` or your join output `joined.csv`, gets one lane per
combination of its ids: `student 101 · course CS101`. If you drop a file with the same name again, it replaces the old
one, so you can re-run the join and reload just `joined.csv`.

Files never leave the browser. They are read locally and kept in `localStorage` together
with the view (focus, hops, tech time, guides, zoom, cursor and selected lane) and your
column choices, so all of it survives a reload. **Reset view** restores the default
view and keeps the files. **Clear** forgets everything. If the files are too large for the browser's quota (usually around 5 MB), a
notice says so and they last only until the tab closes.

## Reading the screen

- **Timeline:** one lane per key. Bars span valid time, and the solid cap marks where a
  version starts. A bar that fades out at the right edge is still open.
- **Tech time:** *As of* shows what the database held at that moment. Step with
  ‹ › through every instant the data changed. *All versions* also shows superseded rows,
  hatched.
- **Focus:** `student` `101` shows only student 101's rows in every table. Hops set how
  many links to follow outward from it. Anything linked to something outside that circle
  stays hidden.
- **Click** anywhere to set a valid-time cursor. The **Snapshot** panel then lists the row
  each table holds at that point, so you can check a joined row against its inputs.
- **Plane:** every version of the selected lane, with valid time across and tech time up.
  A correction shows up as a new rectangle stacked on top of the one it replaces.
- A red **!** marks versions of the same key whose rectangles overlap, meaning two rows
  claim the same valid and tech time.
- Ctrl + scroll zooms, and dragging pans.

## Sample data

[`src/sample/`](src/sample/) follows two students. Alex (101) asks in January to switch
major from Biology to CS, and the office records it only on 2026-03-01, back-dated to January.
A CS101 grade is entered as F on 02-15 and corrected to A on 04-01. `course.csv` never
changes. `joined.csv` is the bitemporal inner join of `student.csv`, `grade.csv` and
`course.csv`, built by intersecting rectangles.
Alex gets three rows in it, not four, because the Biology row was superseded before the A was
recorded. Set the cursor on 2026-02-20 and step *As of* through tech time to see what a review
board meeting that day saw (a Biology student failing), what it would have seen in March (a CS
major failing) and what is known today (a CS major with an A). Sam (102) switches from Math to
Physics, recorded on time, so Sam is a Physics student with a B throughout. Focus on
`student` `101` or `102` to follow one of them, or on `course` `CS101` with 1 hop to see who
took it.

## Development

```bash
npm test           # vitest
npm run lint       # eslint
npm run typecheck  # tsc, strict
npm run coverage
```

`src/core` is pure logic (parsing, filtering, layout), `src/io` reads files, and `src/ui`
holds the React components.
