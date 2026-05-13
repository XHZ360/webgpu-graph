# schema-designer Specification

## Purpose

Define the minimal editable schema designer contract for creating, validating, and exposing UI-ready draft schemas while preserving schema, editor, and runtime boundaries.

## Requirements

### Requirement: Designer creates draft schemas from existing schemas

The system MUST start an editable designer session from an existing `WebGpuSimulationSchema` and produce a modified draft schema as the editing output.

#### Scenario: Starting an edit session

- **WHEN** the designer is opened for an existing schema
- **THEN** it MUST create editor state for a draft schema derived from that input
- **AND** it MUST NOT implicitly mutate the original input schema while the user edits

### Requirement: Designer uses explicit edit operations

The system MUST apply schema edits through explicit editor operations or patches rather than ad hoc website mutations.

#### Scenario: Editing representative schema entities

- **WHEN** a user creates, updates, or deletes a representative resource, pass, or graph node reference
- **THEN** the change MUST be represented as an explicit editor operation or patch
- **AND** the operation result MUST include the updated draft schema or a failure diagnostic

### Requirement: Designer supports minimal CRUD scope

The system MUST support minimal create, read, update, and delete behavior for representative nodes, resources, and passes in the first editable milestone.

#### Scenario: Applying supported CRUD operations

- **WHEN** a supported CRUD operation is applied to a representative entity
- **THEN** the draft schema MUST reflect the requested change while preserving schema structure required by `schema`

#### Scenario: Applying unsupported edits

- **WHEN** a requested edit is outside the minimal supported operation set
- **THEN** the designer MUST reject or disable that edit instead of producing an ambiguous draft schema

### Requirement: Draft validation gates preview consumption

The system MUST validate draft schemas with the schema validator before any preview runtime code consumes them, and preview consumption MUST happen only through an explicit user-requested handoff of the current draft.

#### Scenario: Requesting preview for a valid draft

- **WHEN** a user explicitly requests preview of the current draft
- **AND** the current draft passes schema validation
- **THEN** the designer MAY hand the validated draft schema to preview/runtime
- **AND** the preview/runtime layer MAY accept that draft as the active preview schema

#### Scenario: Blocking preview for an invalid draft

- **WHEN** a user explicitly requests preview of the current draft
- **AND** the current draft fails schema validation
- **THEN** the designer MUST block the handoff
- **AND** preview/runtime MUST NOT consume or execute the invalid draft
- **AND** validation diagnostics MUST be available through editor or UI state

### Requirement: Editing remains separate from WebGPU runtime execution

The system MUST keep designer editing independent from WebGPU runtime execution, and preview/runtime MUST retain ownership of GPU device resources and runtime lifecycle for accepted draft schemas.

#### Scenario: Editing without runtime ownership

- **WHEN** a user edits draft schema data, changes selection, reviews validation diagnostics, or requests handoff eligibility
- **THEN** the designer MUST NOT require or own a `GPUDevice`, command encoder, simulation runner, or running preview loop

#### Scenario: Accepting a validated draft for preview

- **WHEN** preview/runtime accepts a validated draft from an explicit handoff
- **THEN** preview/runtime MAY recreate or reset runtime state for that accepted draft
- **AND** editor/designer code MUST NOT own the `GPUDevice`, command encoder, simulation runner, or preview loop lifecycle used to execute it

### Requirement: Editor exposes UI-ready selection and state

The system MUST expose editor state suitable for a UI surface without requiring full graph layout or persistence, including state that distinguishes the current draft schema from the active preview schema.

#### Scenario: Showing active preview versus current draft

- **WHEN** the designer UI renders draft and preview status
- **THEN** it MUST make clear whether the active preview schema matches the current draft schema
- **AND** it MUST show a dirty or stale state after further edits make the current draft differ from the last accepted preview schema

#### Scenario: Showing handoff diagnostics

- **WHEN** preview handoff is unavailable or blocked because the current draft is invalid
- **THEN** editor or UI state MUST expose diagnostics explaining why the draft cannot be previewed

### Requirement: Designer preserves schema/editor/runtime boundaries

The system MUST preserve `schema` as the source of truth, `editor` as the UI data and editing layer, and preview/runtime as downstream consumers of validated schemas.

#### Scenario: Applying an edit from the website

- **WHEN** website UI controls request a schema edit
- **THEN** they MUST use editor operations or patches and schema validation instead of owning schema semantics directly
