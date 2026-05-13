## Why

The app already has a PBF preview, a minimal editable Schema Designer, and a read-only Schema Graph Inspector, but it lacks a spatial visual canvas for understanding schema structure at a glance. A read-only React Flow based canvas can improve exploration while preserving the current schema/editor/runtime boundaries before introducing editing interactions.

## What Changes

- Add a read-only visual graph canvas capability for schema visualization using a React Flow / XYFlow style website renderer.
- Introduce a renderer-neutral visual projection model in the editor layer for visual nodes, edges, grouping, labels, badges, severity, capability metadata, editability metadata, and source references.
- Add an adapter from existing editor inspection graph/schema data into the visual projection model; the website maps that projection into React Flow nodes and edges.
- Show typed nodes, semantic edges, badges or markers, validation severity, active preview or stale state when available, and a legend or summary.
- Keep the existing Schema Graph Inspector, Schema Designer, and PBF preview available alongside the canvas.
- Keep schema as the source of truth; React Flow data must not become the schema source or editor semantic source.
- Defer mutation and persistence behavior: no drag persistence, no edge editing, no schema mutation, no graph layout save, and no full property editing in this milestone.

## Capabilities

### New Capabilities

- `schema-visual-canvas`: Defines the read-only visual canvas contract, renderer-neutral projection model, React Flow website mapping, validation overlay, and source-of-truth boundaries.

### Modified Capabilities

- None.

## Impact

- Affected packages: editor projection APIs, website visualization UI, documentation, and tests for projection semantics.
- New website dependency expected: React Flow / XYFlow for canvas rendering.
- No breaking changes to existing schema, designer, inspector, preview, or runtime contracts.
- No application implementation is part of this planning change.
