## 1. Visual Projection Contract

- [x] 1.1 Define renderer-neutral visual projection types for nodes, edges, groups, badges, severity, source references, and capability/editability metadata.
- [x] 1.2 Add an editor adapter that derives the visual projection from existing schema inspection graph/schema data.
- [x] 1.3 Ensure projection identifiers and source references remain stable for representative schema entities.
- [x] 1.4 Add focused tests covering PBF projection nodes, semantic edges, metadata, and source-of-truth boundaries.

## 2. React Flow Website Canvas

- [x] 2.1 Add the website React Flow / XYFlow dependency and isolate it from editor package APIs.
- [x] 2.2 Implement a website adapter from visual projection nodes and edges to React Flow-compatible nodes and edges.
- [x] 2.3 Add a read-only canvas surface alongside the existing Inspector, Designer, and PBF preview.
- [x] 2.4 Configure canvas interactions for pan, zoom, selection, and focus without schema mutation, edge editing, or layout persistence.

## 3. Visual Semantics and Validation Overlay

- [x] 3.1 Render typed visual nodes and semantic edges with labels, badges, markers, and grouping cues.
- [x] 3.2 Surface validation severity on projected nodes, edges, or canvas-level summary state when diagnostics are available.
- [x] 3.3 Show active preview and stale draft state on the canvas when that state is available from editor or UI state.
- [x] 3.4 Add a legend or summary explaining node kinds, edge meanings, badges, severity, and readonly status.

## 4. Documentation

- [x] 4.1 Document the visual projection contract and its schema/editor/website source-of-truth boundaries.
- [x] 4.2 Document the readonly first milestone and explicitly list deferred interaction capabilities.
- [x] 4.3 Update website or package documentation to explain how the canvas relates to Inspector, Designer, and PBF preview.

## 5. Validation Checks

- [x] 5.1 Run projection and website tests for the visual canvas implementation.
- [x] 5.2 Run package type checks and lint checks covering editor and website changes.
- [x] 5.3 Run `pnpm dlx @fission-ai/openspec validate add-react-flow-visual-canvas --strict`.
- [x] 5.4 Run `pnpm dlx @fission-ai/openspec validate --all --strict`.
