## Context

The current application exposes a PBF preview, a minimal editable Schema Designer, and a read-only Schema Graph Inspector. Existing specs establish that `schema` remains the source of truth, `editor` prepares UI-facing inspection data, and preview/runtime owns WebGPU execution. The new canvas should add spatial graph comprehension without changing those boundaries or turning React Flow state into semantic schema state.

The implementation should introduce a renderer-neutral visual projection in the editor layer and let the website adapt that projection into React Flow / XYFlow nodes and edges. This separates schema semantics from the chosen canvas library and keeps future interaction work possible without committing the first milestone to editing behavior.

## Goals / Non-Goals

**Goals:**

- Provide a read-only visual canvas for schema graph exploration using React Flow / XYFlow style rendering.
- Define a renderer-neutral visual projection contract containing nodes, edges, kinds, labels, groups, badges, severity, editability or capability metadata, and source references.
- Adapt existing editor inspection/schema output into the visual projection before website rendering.
- Display typed nodes, semantic edges, badges or markers, validation severity, preview active or stale state when available, and a legend or summary.
- Preserve the existing Inspector, Designer, and PBF preview surfaces.
- Keep the schema as source of truth and keep editor projection data derived.

**Non-Goals:**

- Complete visual node editor.
- Drag-to-edit behavior or drag persistence.
- Connection or edge editing.
- Schema mutation from React Flow interactions.
- Saved graph layouts or layout persistence.
- Full property editing panel.
- Import/export workflows.
- Shader IDE functionality.
- Runtime device management or WebGPU lifecycle ownership.

## Decisions

### Decision: Put visual projection in editor, not website

The editor layer should expose a visual projection model derived from existing schema inspection data. The website should only map that projection into React Flow node and edge objects.

Rationale: this preserves project architecture boundaries and prevents website-specific React Flow state from becoming a second semantic model.

Alternatives considered: deriving all nodes directly in the website was simpler for the first screen, but it would duplicate semantic mapping and make future non-React renderers or tests harder.

### Decision: Keep projection renderer-neutral

Visual nodes and edges should use project terms such as `kind`, `label`, `group`, `badges`, `severity`, `sourceRef`, and `capabilities`, rather than React Flow-specific fields as the editor contract.

Rationale: React Flow is an implementation detail of the website canvas. A neutral contract supports tests, documentation, future renderers, and future interaction metadata without locking semantic data to XYFlow types.

Alternatives considered: exposing React Flow nodes from editor would reduce adapter code, but it would couple editor APIs to a UI dependency and blur source-of-truth ownership.

### Decision: First milestone is read-only

Canvas interactions may support navigation, selection, zooming, panning, highlighting, and detail handoff, but they must not persist layout, edit connections, or mutate schemas.

Rationale: the current app already separates editable designer behavior from read-only inspection. This change should add comprehension before adding editing risk.

Alternatives considered: allowing drag layout persistence immediately could improve usability, but persistence needs stable storage, migration, and conflict semantics that are outside the first milestone.

### Decision: Use metadata for future capability-aware interaction

Projection objects should include editability and capability metadata even though this milestone renders them read-only.

Rationale: future work can enable property panels, selection behavior, layout persistence, and capability-aware editing without replacing the projection contract.

Alternatives considered: omit interaction metadata until editing is implemented, but doing so would make the read-only model less useful as a future foundation.

## Risks / Trade-offs

- React Flow dependency increases website bundle surface -> keep React Flow types and imports isolated to website adapter/components.
- Projection could drift from inspector data -> derive from existing editor inspection path and add tests for representative PBF output.
- Read-only affordances may look editable -> use disabled capabilities, legend copy, and cursor/toolbar constraints to communicate readonly scope.
- Validation and preview stale state may be unavailable for some inputs -> model these as optional projection annotations and render absent state explicitly.
- Auto-layout may not be perfect for large graphs -> treat layout as ephemeral renderer state and avoid saving it in this milestone.

## Migration Plan

- Add editor projection types and adapter without changing existing schema, inspector, designer, or preview APIs.
- Add website canvas route/panel or section alongside existing surfaces rather than replacing them.
- Introduce React Flow only in website code paths that render the canvas.
- Rollback by removing the website canvas entry point and projection adapter; existing Inspector, Designer, and preview remain unaffected.

## Open Questions

- Which automatic layout strategy should the first React Flow view use for representative PBF graphs?
- Should canvas selection synchronize with the existing Inspector selection immediately, or remain local until a later interaction milestone?
- Which validation severities are available from current editor diagnostics versus requiring small normalization work?
