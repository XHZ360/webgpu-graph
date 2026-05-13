## MODIFIED Requirements

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
