## 1. Editor Inspection Contract

- [x] 1.1 Add editor tests for `inspectSchema(createPbfSimulationSchema())` covering summary counts, graph node types, edge labels, and representative node IDs
- [x] 1.2 Add editor tests for `getNodeDetail()` covering buffer, layout, shader, pipeline, pass, render graph, and unknown node IDs
- [x] 1.3 Adjust editor graph mapping only if tests expose missing PBF/subgraph inspection detail required by the spec

## 2. Website Inspector Surface

- [x] 2.1 Add a dedicated website inspector module that consumes `editor.inspectSchema()` and the PBF schema without requiring WebGPU
- [x] 2.2 Render read-only summary, graph node/edge listing or simple graph view, and selected-node detail
- [x] 2.3 Wire the inspector into the website shell without breaking the existing PBF runtime demo

## 3. Documentation

- [x] 3.1 Update `packages/editor/README.md` to describe the inspector contract and read-only first milestone
- [x] 3.2 Update website or project docs to distinguish Schema Graph Inspector from future editable designer work

## 4. Validation

- [ ] 4.1 Run targeted editor and website checks/tests for the new inspector path
- [ ] 4.2 Run `openspec validate add-schema-graph-inspector --strict`
- [ ] 4.3 Run the broad repository check if the local `vite-plus` dependency resolution is available
