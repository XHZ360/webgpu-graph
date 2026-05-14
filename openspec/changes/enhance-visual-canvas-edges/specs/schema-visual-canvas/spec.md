## MODIFIED Requirements

### Requirement: Website maps projection to React Flow canvas

The system MUST render the visual projection in the website using a React Flow / XYFlow style canvas adapter while keeping React Flow types out of the editor projection contract.

#### Scenario: Rendering projected graph data

- **WHEN** the website receives a visual projection from the editor layer
- **THEN** it MUST map projection nodes and edges into React Flow-compatible nodes and edges for display
- **AND** it MUST preserve projection identifiers, labels, kinds, semantic edge meanings, badges, markers, and severity indicators in the rendered canvas

#### Scenario: Keeping existing surfaces available

- **WHEN** the visual canvas is available in the website
- **THEN** the existing Schema Graph Inspector, Schema Designer, and PBF preview MUST remain available

#### Scenario: Attaching semantic edges to custom visual nodes

- **WHEN** custom visual nodes are rendered in the React Flow canvas
- **THEN** each node MUST expose read-only source and target connection handles suitable for attaching projected edges
- **AND** those handles MUST NOT allow users to create, reconnect, delete, or persist edges

#### Scenario: Placing canvas below preview

- **WHEN** the website mounts the PBF preview and Schema Visual Canvas surfaces
- **THEN** the Schema Visual Canvas MUST appear after the PBF preview and before the Schema Designer and Schema Graph Inspector surfaces

### Requirement: Canvas is read-only in the first milestone

The visual canvas MUST be read-only for the first milestone and MUST NOT mutate schema content, editor semantic state, runtime state, or persisted layout state.

#### Scenario: Interacting with the canvas

- **WHEN** a user pans, zooms, selects, focuses, filters, or navigates visual canvas content
- **THEN** the underlying `WebGpuSimulationSchema` MUST remain unchanged
- **AND** the canvas MUST NOT persist node positions, create edges, delete edges, edit properties, reconnect edges, or apply schema mutations

#### Scenario: Dragging visual nodes

- **WHEN** a user drags a rendered visual node in the React Flow canvas
- **THEN** any position change MUST be treated as transient renderer state
- **AND** the system MUST NOT save graph layout or interpret the drag as a schema edit

### Requirement: Canvas displays semantics and validation overlay

The visual canvas MUST display graph semantics and validation-oriented overlays needed to understand schema structure and state.

#### Scenario: Showing graph semantics

- **WHEN** the visual canvas renders projected data
- **THEN** it MUST show typed nodes, semantic edges, node or edge badges, markers where applicable, and a legend or summary explaining visible kinds and states

#### Scenario: Showing validation and preview state

- **WHEN** validation severity, active preview state, or stale preview state is available in editor or UI state
- **THEN** the visual canvas MUST show that information in the projection or overlay without requiring runtime execution ownership

#### Scenario: Showing structural edges by default

- **WHEN** the visual canvas first renders a projection containing semantic edges
- **THEN** it MUST show structural relationship edges by default, including resource binding, layout usage, program usage, render graph containment, and execution dependency meanings when present

#### Scenario: Highlighting adjacent relationships

- **WHEN** a user selects a rendered visual node or edge
- **THEN** directly adjacent nodes and edges MUST be visually emphasized
- **AND** non-adjacent visible nodes and edges SHOULD be visually de-emphasized without removing them from the derived projection

#### Scenario: Filtering by edge type

- **WHEN** a user toggles semantic edge type filters
- **THEN** the canvas MUST update the visible React Flow edges to match the enabled edge meanings
- **AND** filtering MUST operate on derived renderer state without mutating the editor visual projection or schema source data
