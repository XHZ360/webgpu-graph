## Why

The project already has schema visualization primitives and editor inspection data, but there is no user-facing surface that exposes the schema graph, summary, and node details together. A read-only Schema Graph Inspector gives the project a safe first visualization milestone before committing to full drag/drop designer semantics.

## What Changes

- Add a read-only inspector capability for viewing a `WebGpuSimulationSchema` as graph data, summary data, and selected-node detail.
- Surface the existing schema/editor inspection path through a narrow website entrypoint using the PBF schema as the first target.
- Add tests around editor graph mapping so visualization behavior is stable before interactive editing work begins.
- Keep runtime preview and schema editing out of scope for this change.

## Capabilities

### New Capabilities

- `schema-graph-inspector`: Read-only schema visualization and inspection for graph, summary, and node detail surfaces.

### Modified Capabilities

None.

## Impact

- `packages/editor`: strengthen inspection DTO behavior and tests.
- `packages/schema`: reuse existing visualization helpers without changing schema semantics.
- `apps/website`: add a minimal inspector-facing surface for the current PBF schema.
- `packages/preview`: no runtime behavior changes; preview remains downstream and separate.
- No new persisted schema format, graph editing workflow, or drag/drop designer behavior is introduced.
