## Why

The read-only Schema Graph Inspector establishes a safe schema-to-editor inspection path, but users still cannot make controlled schema changes from an editor surface. The next milestone should introduce a minimal editable schema designer that preserves `schema` as the source of truth while using `editor` as the UI data and editing layer.

This change defines a narrow editing contract before adding a complete visual node editor. The designer starts from an existing `WebGpuSimulationSchema`, applies explicit editor operations to produce a modified draft schema, validates the draft, and only then allows preview runtime consumption.

## What Changes

- Add an editable schema designer capability for producing draft schemas from existing `WebGpuSimulationSchema` inputs without implicitly mutating the original input.
- Define minimal CRUD editing for representative nodes, resources, and passes through explicit editor operations or patches.
- Require draft validation with the schema validator before any preview runtime consumption.
- Keep WebGPU runtime execution separate from editing so no `GPUDevice` is required to inspect or edit drafts.
- Expose selection and editor state suitable for a UI without requiring full graph layout persistence in this milestone.

## Capabilities

### New Capabilities

- `schema-designer`: Minimal editable schema designer contract for draft schema editing, validation, and UI state.

### Modified Capabilities

None.

## Impact

- `packages/editor`: define the draft editing contract, operation/patch behavior, selection state, and validation handoff.
- `packages/schema`: remains the source of truth and validator authority for draft schemas.
- `apps/website`: gains a minimal designer surface that uses editor data and operations without owning schema semantics.
- `packages/preview`: consumes only validated draft schemas and remains separate from editing and device management.
- No full visual node editor, shader authoring IDE, persisted import/export workflow, runtime device management, or automatic layout is introduced.
