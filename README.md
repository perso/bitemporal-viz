# bitemporal-viz

A browser tool for looking at bitemporal tables side by side. Load your source tables and
their join as CSVs, and every key's versions appear on one valid-time axis.

```bash
npm install
npm run dev        # http://localhost:5173 — click "Load sample" to see the demo data
```

## Input

One CSV per table, named after the entity it holds:

```csv
# connection.csv
connection_id,party_a_id,party_b_id,role_a,role_b,valid_from,valid_to,tech_valid_from,tech_valid_to
100,1,2,supplier,customer,2024-02-15,2024-05-01,2024-05-01 09:00:00,
100,1,2,supplier,reseller,2024-05-01,,2024-05-01 09:00:00,
```

| Column | Rule |
|---|---|
| `valid_from` `valid_to` `tech_valid_from` `tech_valid_to` | Required. Other accepted names are in [`src/config/columns.json`](src/config/columns.json). A blank value, `null` or year 9999 means an open end. Times without an offset are read as UTC. |
| `<entity>_id` | Links the row to an entity. The column name must equal the entity, or start or end with it: `party_a_id` and `owner_party_id` both point to `party.csv`. |
| everything else | Descriptive. The first two such values label the bar, and the tooltip shows them all. |

A table whose own id is present (`connection_id` in `connection.csv`) gets one lane per id.
A table without one, like `group_connection.csv` or your join output, gets one lane per
combination of its ids. If you drop a file with the same name again, it replaces the old
one, so you can re-run the join and reload just `joined.csv`.

Files never leave the browser. They are read locally and kept in `localStorage`, so they
survive a reload until you press **Clear**. If they are too large for the browser's quota
(usually around 5 MB), a notice says so and the files last only until the tab closes.

## Reading the screen

- **Timeline:** one lane per key. Bars span valid time, and the solid cap marks where a
  version starts. A bar that fades out at the right edge is still open.
- **Tech time:** *As of* shows what the database held at that moment. Step with
  ‹ › through every instant the data changed. *All versions* also shows superseded rows,
  hatched.
- **Focus:** `connection` `100` with 1 hop shows connection 100, its two parties, its
  group, its mapping row and its joined rows. Anything linked to something outside that
  circle stays hidden. 0 hops shows only the entity itself.
- **Click** anywhere to set a valid-time cursor. The **Snapshot** panel then lists the row
  each table holds at that point, so you can check a joined row against its inputs.
- **Plane:** every version of the selected lane, with valid time across and tech time up.
  A correction shows up as a new rectangle stacked on top of the one it replaces.
- A red **!** marks versions of the same key whose rectangles overlap, meaning two rows
  claim the same valid and tech time.
- Ctrl + scroll zooms, and dragging pans.

## Sample data

[`src/sample/`](src/sample/) follows one story. Rows are created in the order party,
connection, group (if it does not exist yet), membership, a few seconds apart in tech time.
They are deleted in reverse. Party 1 is renamed with effect from 2024-06-01, recorded on
06-03. Party 3's typo is corrected retroactively. Connection 100 changes role on 05-01 and
ends on 09-30: its membership is closed first, then the connection. The mapping of
connection 101 to group 10 arrives late. `joined.csv` is their bitemporal inner join, built by intersecting
rectangles.

## Development

```bash
npm test           # vitest
npm run lint       # eslint
npm run typecheck  # tsc, strict
npm run coverage
```

`src/core` is pure logic (parsing, filtering, layout), `src/io` reads files, and `src/ui`
holds the React components.
