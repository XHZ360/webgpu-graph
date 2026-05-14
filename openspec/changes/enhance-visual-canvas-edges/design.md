## Context

The current Schema Visual Canvas already derives renderer-neutral nodes and semantic edges from `editor.createVisualProjection()` and maps them to React Flow in the website. The data path includes edges for bindings, layouts, shaders, pipelines, passes, render graph containment, and execution dependencies, but the custom React Flow node renderer does not define explicit source/target handles. That makes the visual connection behavior depend on defaults rather than visible, stable attachment points.

The canvas currently appears after Designer and Inspector in the website app shell. The desired flow is to see the preview first, then immediately inspect the visual graph that explains the same schema/runtime structure before moving into editing and detailed inspector surfaces.

## Goals / Non-Goals

**Goals:**

- Add visible, read-only source and target handles to custom visual nodes so semantic edges clearly connect associated nodes.
- Keep existing editor projection edges as the source of truth for what is related.
- Default the canvas to display structural relationship edges that explain topology, including resource/binding/layout/program/execution/render graph relationships.
- Highlight directly adjacent nodes and edges when a canvas node or edge is selected.
- Add edge type filters for semantic edge meanings without mutating schema or projection data.
- Move Schema Visual Canvas directly below the PBF preview in the website layout.

**Non-Goals:**

- No schema mutation from handles or edge interactions.
- No user-created edges, edge deletion, reconnection, or connection validation workflow.
- No persisted layout or saved filter preferences.
- No change to `editor` exposing React Flow / XYFlow types.
- No runtime/WebGPU device ownership by the canvas.
- No replacement of the Inspector, Designer, or PBF preview surfaces.

## Decisions

### Decision: Handles are renderer-only affordances

Custom visual nodes should render React Flow source and target handles in the website component, but the editor projection contract should remain renderer-neutral.

Rationale: handles solve a React Flow rendering/interaction affordance problem. Adding handle concepts to `editor` would leak renderer details into the semantic projection layer.

Alternatives considered: adding handle positions to `VisualNode` metadata. This would make tests and future renderers more explicit, but it couples the neutral contract to a current React Flow layout choice.

### Decision: Keep all semantic edges available, filter in website state

The website should receive the full projected edge set and derive visible edges from UI filter state. Filtering should not mutate `VisualProjection` or change schema/editor semantics.

Rationale: selection and filtering are view concerns. Keeping the full projection intact preserves source-of-truth boundaries and allows filters to be reset without recomputing semantic data.

Alternatives considered: ask `createVisualProjection()` for only selected edge kinds. This reduces website work but makes a display preference look like a semantic projection concern.

### Decision: Default edge visibility favors structural comprehension

The default filter set should show relationship edges that explain schema topology: resource binding, layout usage, shader/pipeline/pass usage, render graph containment, and execution dependencies.

Rationale: the first canvas view should make related nodes visibly connected, not require the user to discover filters before the graph is meaningful.

Alternatives considered: default to only dependency edges. This is visually quieter but hides important resource, binding, and pipeline relationships.

### Decision: Selection highlights first-degree adjacency

When a node is selected, directly connected edges and their opposite endpoint nodes should be highlighted while non-adjacent items are visually de-emphasized. When an edge is selected, that edge and its source/target nodes should be highlighted.

Rationale: first-degree adjacency is predictable, cheap to compute from visible edges, and enough to answer “what is this node related to?” without introducing traversal depth controls.

Alternatives considered: multi-hop highlighting. It can be useful later, but it needs depth controls and risks making dense graphs hard to read.

### Decision: Reorder website sections without changing ownership

The app shell should mount Visual Canvas immediately after PBF preview and before Designer / Inspector. The canvas still consumes schema/editor UI state and remains read-only.

Rationale: preview-first ordering better matches exploration: run/see the simulation, inspect the visual structure, then edit or inspect details.

Alternatives considered: adding tabs. Tabs would reduce page length but introduce routing/state complexity that is unnecessary for this milestone.

## Risks / Trade-offs

- Dense edges may still create visual clutter -> Provide edge type filters and adjacency highlighting to narrow the view.
- Handles may look like editable connection points -> Disable connectability and style handles as readonly anchors, not drag targets.
- Selection state can conflict with existing Designer selection semantics -> Keep canvas selection local unless a later change explicitly synchronizes selection.
- Filter defaults may not match every debugging task -> Keep all edge type controls visible and resettable.
- Reordering page sections may surprise users used to the old order -> Update website documentation and keep all existing surfaces present.

## Migration Plan

- Update website mounting order so Visual Canvas appears below PBF preview.
- Add renderer-only handles to the custom node component with connection interactions disabled.
- Add local canvas UI state for selected element and enabled edge meanings.
- Derive visible/highlighted React Flow nodes and edges from projection plus local UI state.
- Add tests for default visible edge types, filter behavior, readonly handle/connection settings, and adjacency highlighting.
- Roll back by restoring the previous app shell order and rendering all projected edges without local filter/highlight state.

## Open Questions

- Should edge filters group meanings into user-facing categories, or expose each `VisualEdgeMeaning` individually?
- Should the default include every edge type initially, or exclude only fallback `references` edges if they appear later?
- Should selected edge highlighting update the summary panel with source/target details, or remain purely visual for this change?
