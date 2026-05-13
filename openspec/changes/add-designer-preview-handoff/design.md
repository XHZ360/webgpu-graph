## Context

The editable Schema Designer milestone established draft editing, schema validation, and UI handoff status. However, the website preview/runtime demo can still run from an independent schema, which leaves the user-facing path from a validated designer draft to an executing preview underspecified.

This milestone defines the handoff contract without changing ownership boundaries. The designer can request that the current validated draft becomes the preview input, but preview/runtime remains the owner of WebGPU device resources and execution lifecycle.

## Goals / Non-Goals

**Goals:**

- Provide an explicit user action to request previewing the current designer draft.
- Allow only validated draft schemas to be handed to preview/runtime.
- Block invalid draft handoff with diagnostics visible to the user.
- Make the active preview schema distinct from the current draft schema in UI state.
- Mark preview state dirty or stale when the user edits after a successful handoff.
- Keep `GPUDevice`, command encoder, and simulation runner lifecycle out of editor/designer code.
- Allow preview/runtime to recreate or reset runtime state when accepting a new draft.

**Non-Goals:**

- No live hot-reload on every edit.
- No editor-side runtime management.
- No invalid schema execution.
- No full persistence/import/export workflow.
- No shader IDE.

## Decisions

### Decision: Preview handoff is an explicit user action

The designer UI will expose a deliberate action, such as "Preview current draft", instead of pushing every edit into runtime. The action requests handoff of the current draft and its validation result.

Alternatives considered:

- Live hot-reload on every edit: rejected because the milestone requires a safe, intentional gate and would otherwise blur editing with runtime execution.
- Implicit preview on save: rejected because full persistence/import/export is out of scope.

### Decision: Validation gates all handoff

Only drafts that pass the authoritative schema validator may be accepted for preview. If validation fails, the handoff request must be blocked and diagnostics must remain in editor/UI state.

Alternatives considered:

- Let preview validate or fail at runtime: rejected because invalid drafts must not enter execution.
- Trust designer-local state without validation: rejected because `schema` remains the validation authority.

### Decision: Runtime owns GPU lifecycle

Preview/runtime accepts a validated draft schema as input and may recreate or reset its runtime state for that accepted draft. Editor/designer code must not own `GPUDevice`, command encoders, simulation runners, or preview loop lifecycle.

Alternatives considered:

- Designer constructs runtime resources before handoff: rejected because it moves device lifecycle into the editing layer.
- Share a simulation runner between designer and preview: rejected because it couples editing state to execution state.

### Decision: UI tracks draft versus active preview state

The UI must show whether the preview is running the current validated draft or an older accepted schema. After a successful handoff, further edits make the draft dirty or the preview stale until the user requests another valid handoff.

Alternatives considered:

- Show only a generic valid/invalid flag: rejected because users need to know whether preview reflects the current draft.
- Auto-reset preview on every edit: rejected because live hot-reload is a non-goal.

## Risks / Trade-offs

- [Risk] Users may expect immediate preview updates after editing -> Mitigation: label the active preview schema and stale/dirty state clearly.
- [Risk] Handoff metadata may duplicate validation state -> Mitigation: keep schema validation authoritative and expose only UI-ready status from editor/designer.
- [Risk] Runtime reset may interrupt preview state -> Mitigation: make reset/recreate behavior part of preview/runtime ownership for the accepted draft.
- [Risk] Website code may reach into runtime lifecycle from designer controls -> Mitigation: specify a narrow handoff request boundary and keep device resources in preview/runtime.
