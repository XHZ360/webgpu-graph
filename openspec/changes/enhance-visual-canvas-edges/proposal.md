## Why

The current Visual Canvas derives semantic edges, but custom rendered nodes need stable connection handles and richer edge controls so related nodes are visibly and legibly connected. The canvas also appears after the schema surfaces today; placing it directly under the preview better matches the user's workflow of previewing first, then inspecting the visual dependency structure.

## What Changes

- Add read-only React Flow handles to custom visual nodes so existing projection edges attach to visible node connection points.
- Default the canvas to show structural relationship edges that explain schema topology without immediately overwhelming the view.
- Add selection-driven adjacency highlighting so selecting a node emphasizes directly connected nodes and edges while de-emphasizing unrelated graph elements.
- Add edge type filters for semantic meanings such as resource binding, layout usage, pipeline/shader usage, render graph containment, and execution dependencies.
- Move the Schema Visual Canvas section in the website layout to appear directly below the PBF preview and before Designer / Inspector surfaces.
- Preserve the read-only milestone: filters, selection, focus, and highlighting must not mutate schema, projection semantics, runtime state, or persisted layout.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `schema-visual-canvas`: Clarify visible edge attachment, default structural edge rendering, adjacency highlighting, edge type filtering, and website placement below preview.

## Impact

- Affected packages: `apps/website` React Flow canvas rendering, visual canvas adapter/UI state, CSS styling, tests, and website documentation.
- Existing editor projection APIs should remain the source of truth for semantic nodes and edges; implementation should avoid adding React Flow types to `editor`.
- No new runtime/WebGPU ownership, schema mutation, edge editing, layout persistence, or package dependency is expected.
