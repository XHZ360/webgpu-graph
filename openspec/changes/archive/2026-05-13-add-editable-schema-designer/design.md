## Context

`schema` owns `WebGpuSimulationSchema` semantics, validation, and runtime-ready structure. `editor` already provides inspection DTOs for graph, summary, and selected-node detail. The archived `add-schema-graph-inspector` change intentionally kept the first milestone read-only so the schema/editor/UI boundary could stabilize before editing semantics were specified.

The next milestone should add editing without turning the website into the source of schema truth. Editing must be explicit, draft-based, and validation-gated so runtime preview remains downstream from the schema validator.

## Goals / Non-Goals

**Goals:**

- Start from an existing `WebGpuSimulationSchema` and produce a modified draft schema.
- Avoid implicit mutation of the original schema input.
- Support minimal CRUD for representative nodes, resources, and passes through editor operations or patches.
- Validate drafts with the schema validator before preview runtime consumption.
- Keep editing independent from WebGPU runtime execution and `GPUDevice` access.
- Expose selection and editing state that a UI can render without requiring full graph layout persistence.

**Non-Goals:**

- No complete visual node editor.
- No arbitrary shader authoring IDE.
- No full import/export persistence workflow.
- No runtime device management.
- No automatic layout.
- No persisted graph layout format in this milestone.

## Decisions

### Decision: Draft schema is the editing output

The designer will accept an existing `WebGpuSimulationSchema` and return an updated draft schema through explicit editor operations or patches. The original input must not be mutated implicitly.

Alternatives considered:

- Mutate the input object directly: rejected because UI interaction would be able to change source schema state before validation or user intent is clear.
- Maintain a separate editor-only schema model: rejected because `schema` must remain the source of truth.

### Decision: Keep the first editable milestone minimal

The first editable slice will cover representative CRUD for selected schema entities, such as resources, passes, and graph node references, instead of attempting full graph authoring.

Alternatives considered:

- Full designer first: rejected because layout, complex dependency editing, and persistence semantics are not yet required.
- Inspector-only follow-up: rejected because the next useful milestone needs to prove validation-gated draft editing.

### Decision: Validation gates preview consumption

Draft schemas must pass the schema validator before they are handed to preview runtime code. Validation errors remain editor/UI feedback and must not require a running WebGPU device.

Alternatives considered:

- Let preview discover invalid drafts: rejected because runtime failures would blur editor validation with execution.
- Add designer-specific validation rules only: rejected because `schema` validation is the authoritative contract.

### Decision: Runtime execution stays separate

Editing, selection, and validation are editor/schema concerns. The designer must not require a `GPUDevice`, command encoder, simulation runner, or preview loop to edit a draft.

Alternatives considered:

- Couple editing to live preview state: rejected because runtime device lifecycle and schema editing have different responsibilities.
- Manage runtime devices from the designer: rejected because device management belongs outside this milestone.

### Decision: UI state is intentionally shallow

The editor contract should expose selected entity state, dirty/valid status, validation diagnostics, and draft identifiers needed by a UI. Full visual layout, automatic layout, and layout persistence are deferred.

Alternatives considered:

- Persist node coordinates immediately: rejected because layout semantics are not needed for minimal editing.
- Require a graph canvas library contract now: rejected because editor operations should remain independent of rendering technology.

## Risks / Trade-offs

- [Risk] Minimal CRUD may be mistaken for a complete node editor -> Mitigation: document the limited operation set and non-goals clearly.
- [Risk] Draft editing can diverge from schema validation -> Mitigation: all preview handoff is gated by the schema validator.
- [Risk] UI code may duplicate schema semantics -> Mitigation: website uses editor operations and schema validation rather than editing raw structures directly.
- [Risk] Lack of layout persistence limits visual editing polish -> Mitigation: defer layout until editing semantics and validation flow are stable.
