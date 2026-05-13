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

The system MUST validate draft schemas with the schema validator before any preview runtime code consumes them.

#### Scenario: Previewing a valid draft

- **WHEN** a draft schema passes schema validation
- **THEN** the preview layer MAY consume that validated draft schema

#### Scenario: Previewing an invalid draft

- **WHEN** a draft schema fails schema validation
- **THEN** the preview layer MUST NOT consume the invalid draft
- **AND** validation diagnostics MUST be available through editor or UI state

### Requirement: Editing remains separate from WebGPU runtime execution

The system MUST keep designer editing independent from WebGPU runtime execution.

#### Scenario: Editing without a runtime device

- **WHEN** a user edits draft schema data, changes selection, or reviews validation diagnostics
- **THEN** the designer MUST NOT require a `GPUDevice`, command encoder, simulation runner, or running preview loop

### Requirement: Editor exposes UI-ready selection and state

The system MUST expose editor state suitable for a UI surface without requiring full graph layout or persistence.

#### Scenario: Selecting editable entities

- **WHEN** a user selects a node, resource, pass, or graph-related entity
- **THEN** editor state MUST expose the selected entity identifier, selected entity type, draft dirty state, and current validation status

#### Scenario: Rendering without layout persistence

- **WHEN** the designer UI renders editable schema state
- **THEN** it MUST NOT require persisted node coordinates, automatic layout output, or a complete visual node editor contract

### Requirement: Designer preserves schema/editor/runtime boundaries

The system MUST preserve `schema` as the source of truth, `editor` as the UI data and editing layer, and preview/runtime as downstream consumers of validated schemas.

#### Scenario: Applying an edit from the website

- **WHEN** website UI controls request a schema edit
- **THEN** they MUST use editor operations or patches and schema validation instead of owning schema semantics directly
