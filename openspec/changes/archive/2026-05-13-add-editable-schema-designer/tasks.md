## 1. Editor Edit Contract

- [x] 1.1 Define editor draft creation from an existing `WebGpuSimulationSchema` without implicitly mutating the input schema
- [x] 1.2 Define explicit editor operations or patches for minimal create, update, and delete behavior across representative resources, passes, and graph node references
- [x] 1.3 Define editor selection, dirty state, validation status, and diagnostics data suitable for a UI surface
- [x] 1.4 Add targeted editor tests for draft immutability, operation results, invalid operations, and representative CRUD behavior

## 2. Website Designer Surface

- [x] 2.1 Add a minimal website designer surface that starts from an existing schema and renders editor-provided draft, selection, and validation state
- [x] 2.2 Wire representative add, edit, and delete controls through editor operations or patches instead of direct website schema mutation
- [x] 2.3 Keep the existing read-only inspection path available while adding editable draft controls
- [x] 2.4 Avoid requiring graph layout persistence, automatic layout, or a graph canvas dependency in this milestone

## 3. Validation Flow

- [x] 3.1 Validate draft schemas with the schema validator before preview runtime consumption
- [x] 3.2 Surface validation diagnostics in editor/UI state without requiring `GPUDevice` access
- [x] 3.3 Ensure preview receives only validated draft schemas and remains separate from edit operations

## 4. Documentation

- [x] 4.1 Document the designer as a minimal editable milestone after the read-only Schema Graph Inspector
- [x] 4.2 Document that `schema` remains the source of truth and `editor` owns UI data/editing operations
- [x] 4.3 Document non-goals including complete visual node editing, shader IDE behavior, persistence, runtime device management, and automatic layout

## 5. Validation Checks

- [x] 5.1 Run targeted editor tests for draft editing behavior and validation handoff
- [x] 5.2 Run website checks for the minimal designer surface if implementation touches website code
- [x] 5.3 Run `pnpm dlx @fission-ai/openspec validate add-editable-schema-designer --strict`
