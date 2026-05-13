## 1. Handoff Contract

- [x] 1.1 Define the explicit designer action for requesting preview of the current draft schema
- [x] 1.2 Define the accepted handoff payload, including the validated draft schema and any draft identity or version metadata needed by UI state
- [x] 1.3 Require schema-validator success before handoff eligibility is true
- [x] 1.4 Define blocked handoff behavior for invalid drafts, including diagnostic propagation and no preview/runtime consumption

## 2. Website Runtime Integration

- [x] 2.1 Wire the website preview request control to the handoff contract instead of direct schema mutation
- [x] 2.2 Ensure preview/runtime accepts only validated handoff schemas from the designer path
- [x] 2.3 Keep `GPUDevice`, command encoder, simulation runner, and preview loop lifecycle owned by preview/runtime code
- [x] 2.4 Allow preview/runtime to recreate or reset runtime state when accepting a validated draft

## 3. State/Diagnostics UX

- [x] 3.1 Display whether the active preview schema matches the current designer draft
- [x] 3.2 Mark preview state dirty or stale after edits made since the last successful handoff
- [x] 3.3 Disable or block preview handoff for invalid drafts while showing validation diagnostics
- [x] 3.4 Show handoff success, blocked, and stale states without implying live hot-reload

## 4. Documentation

- [x] 4.1 Document the explicit designer-to-preview handoff flow and validation gate
- [x] 4.2 Document that preview/runtime owns GPU device resources and may reset runtime state for accepted drafts
- [x] 4.3 Document non-goals: live hot-reload on every edit, editor-side runtime management, invalid schema execution, full persistence/import/export, and shader IDE behavior

## 5. Validation Checks

- [x] 5.1 Add or update tests for valid draft handoff and invalid draft blocking
- [x] 5.2 Add or update website checks for active preview versus current draft dirty/stale UX
- [x] 5.3 Run `pnpm dlx @fission-ai/openspec validate add-designer-preview-handoff --strict`
- [x] 5.4 Run `pnpm dlx @fission-ai/openspec validate --all --strict`
