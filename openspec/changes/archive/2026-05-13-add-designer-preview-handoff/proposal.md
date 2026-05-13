## Why

The current Schema Designer validates draft schemas and shows handoff status, but the running preview still uses an independent schema. The next milestone should define a safe and explicit handoff from the website designer's validated draft schema to the preview/runtime demo without allowing invalid drafts to execute.

This change keeps the boundary clear: the editor/designer owns draft editing, validation status, and UI state, while preview/runtime owns `GPUDevice` resources, command encoding, simulation runner lifecycle, and any runtime reset needed to accept a new schema.

## What Changes

- Add an explicit user action for requesting preview of the current designer draft.
- Require schema validation to succeed before a draft can be handed to preview/runtime.
- Block invalid draft handoff and surface validation diagnostics instead of executing the invalid schema.
- Define preview/runtime ownership of GPU device resources and runtime recreation/reset for the accepted draft.
- Require the UI to distinguish the active preview schema from the current draft, including dirty or stale state after further edits.
- Preserve the editor/designer boundary so no `GPUDevice`, command encoder, or simulation runner lifecycle moves into designer code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `schema-designer`: Extend the editable designer contract with explicit preview handoff, validation gating, runtime ownership boundaries, and active-preview versus draft UI state.

## Impact

- `packages/editor`: may expose handoff eligibility, draft identity/version metadata, and diagnostics needed by the website UI.
- `apps/website`: wires an explicit preview action and state indicators for current draft versus active preview schema.
- `packages/preview`: accepts only validated schemas from the handoff and remains responsible for runtime/device lifecycle.
- No live hot-reload, editor-side runtime management, invalid schema execution, full persistence/import/export, or shader IDE behavior is introduced.
