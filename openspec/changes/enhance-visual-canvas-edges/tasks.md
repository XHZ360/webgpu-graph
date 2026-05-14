## 1. Canvas Placement

- [x] 1.1 Reorder the website app shell so Schema Visual Canvas mounts directly below the PBF preview and before Designer / Inspector.
- [x] 1.2 Update fatal mount-point messaging and website documentation to reflect the new surface order.

## 2. Readonly Node Handles

- [x] 2.1 Add React Flow source and target handles to the custom visual node card.
- [x] 2.2 Style handles as readonly attachment anchors without making them look like editable connection controls.
- [x] 2.3 Ensure node and canvas connectability settings still prevent connection creation, reconnection, deletion, and schema mutation.

## 3. Edge Visibility and Filtering

- [x] 3.1 Define website-local edge meaning filter categories for structural relationships.
- [x] 3.2 Render edge type filter controls in the Visual Canvas summary or toolbar.
- [x] 3.3 Derive visible React Flow edges from the full projection and enabled filter state without mutating projection data.
- [x] 3.4 Keep structural relationship edges enabled by default, including resource binding, layout usage, program usage, render graph containment, and execution dependency meanings.

## 4. Selection and Adjacency Highlighting

- [x] 4.1 Track selected canvas node or edge in website-local React Flow state.
- [x] 4.2 Compute first-degree adjacent node and edge IDs from the currently visible edge set.
- [x] 4.3 Apply visual emphasis to selected and adjacent nodes/edges and de-emphasis to unrelated visible elements.
- [x] 4.4 Preserve read-only selection behavior and avoid synchronizing with Designer selection unless explicitly added later.

## 5. Tests and Validation

- [x] 5.1 Add website tests for default structural edge visibility and edge type filtering.
- [x] 5.2 Add website tests for readonly handle/connectability settings on custom nodes.
- [x] 5.3 Add website tests for node and edge adjacency highlighting derivation.
- [x] 5.4 Run website tests and build checks for the Visual Canvas changes.
- [x] 5.5 Run `pnpm dlx @fission-ai/openspec validate enhance-visual-canvas-edges --strict`.
- [x] 5.6 Run `pnpm dlx @fission-ai/openspec validate --all --strict`.
