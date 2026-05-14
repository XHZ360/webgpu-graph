## Purpose

Define the read-only visual canvas contract for schema graph exploration, including the editor visual projection, website renderer mapping, source-of-truth boundaries, validation overlays, and future interaction metadata.

## Requirements

### Requirement: Editor exposes renderer-neutral visual projection

The system MUST expose a renderer-neutral visual projection derived from schema/editor inspection data for use by visual graph renderers.

#### Scenario: Creating a visual projection

- **WHEN** a valid `WebGpuSimulationSchema` is projected for visual canvas rendering
- **THEN** the editor layer MUST return visual nodes and edges with stable identifiers, kind, label, semantic grouping, source references, and renderer-neutral metadata
- **AND** the projection MUST be derived from schema/editor inspection data rather than React Flow node state

#### Scenario: Representing visual metadata

- **WHEN** visual nodes or edges are returned by the projection
- **THEN** they MUST be able to include badges, markers, validation severity, editability metadata, capability metadata, and source references without requiring a specific renderer library

### Requirement: Website maps projection to React Flow canvas

The system MUST render the visual projection in the website using a React Flow / XYFlow style canvas adapter while keeping React Flow types out of the editor projection contract.

#### Scenario: Rendering projected graph data

- **WHEN** the website receives a visual projection from the editor layer
- **THEN** it MUST map projection nodes and edges into React Flow-compatible nodes and edges for display
- **AND** it MUST preserve projection identifiers, labels, kinds, semantic edge meanings, badges, markers, and severity indicators in the rendered canvas

#### Scenario: Keeping existing surfaces available

- **WHEN** the visual canvas is available in the website
- **THEN** the existing Schema Graph Inspector, Schema Designer, and PBF preview MUST remain available

### Requirement: Canvas is read-only in the first milestone

The visual canvas MUST be read-only for the first milestone and MUST NOT mutate schema content, editor semantic state, runtime state, or persisted layout state.

#### Scenario: Interacting with the canvas

- **WHEN** a user pans, zooms, selects, focuses, or navigates visual canvas content
- **THEN** the underlying `WebGpuSimulationSchema` MUST remain unchanged
- **AND** the canvas MUST NOT persist node positions, create edges, delete edges, edit properties, or apply schema mutations

#### Scenario: Dragging visual nodes

- **WHEN** a user drags a rendered visual node in the React Flow canvas
- **THEN** any position change MUST be treated as transient renderer state
- **AND** the system MUST NOT save graph layout or interpret the drag as a schema edit

### Requirement: Schema remains source of truth

The system MUST keep schema data as the source of truth and MUST treat editor visual projection and React Flow canvas data as derived representations.

#### Scenario: Deriving canvas state

- **WHEN** the canvas needs graph semantics for resources, passes, graph nodes, or edges
- **THEN** it MUST obtain them from the editor visual projection derived from schema data
- **AND** it MUST NOT treat React Flow nodes or edges as the canonical schema source or editor semantic source

### Requirement: Canvas displays semantics and validation overlay

The visual canvas MUST display graph semantics and validation-oriented overlays needed to understand schema structure and state.

#### Scenario: Showing graph semantics

- **WHEN** the visual canvas renders projected data
- **THEN** it MUST show typed nodes, semantic edges, node or edge badges, markers where applicable, and a legend or summary explaining visible kinds and states

#### Scenario: Showing validation and preview state

- **WHEN** validation severity, active preview state, or stale preview state is available in editor or UI state
- **THEN** the visual canvas MUST show that information in the projection or overlay without requiring runtime execution ownership

### Requirement: Canvas remains separate from WebGPU runtime execution

The visual canvas MUST remain separate from WebGPU runtime execution and device lifecycle management.

#### Scenario: Rendering without runtime ownership

- **WHEN** the visual canvas displays schema projection data, validation overlays, legend content, or selection state
- **THEN** it MUST NOT require or own a `GPUDevice`, command encoder, simulation runner, or running preview loop

### Requirement: Projection supports future interaction milestones

The visual projection MUST be compatible with future interaction milestones without enabling editing in the read-only milestone.

#### Scenario: Exposing future-compatible metadata

- **WHEN** projection nodes or edges describe possible interactions
- **THEN** they MUST expose capability-aware and editability metadata as descriptive state
- **AND** the read-only canvas MUST render disabled or informational affordances rather than executing schema edits
