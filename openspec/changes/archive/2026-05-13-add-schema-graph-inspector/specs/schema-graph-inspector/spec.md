## ADDED Requirements

### Requirement: Inspector exposes schema summary

The system MUST expose a read-only summary for a selected `WebGpuSimulationSchema` using the existing schema/editor inspection path.

#### Scenario: Viewing PBF schema summary

- **WHEN** the inspector is opened for the PBF schema
- **THEN** it MUST show schema-level summary data including name, version, resource counts, pass counts, graph count, and main graph reference

### Requirement: Inspector exposes graph nodes and edges

The system MUST expose graph nodes and edges derived from `editor.inspectSchema()` rather than deriving a separate website-specific graph model.

#### Scenario: Viewing graph structure

- **WHEN** the inspector receives graph data from `editor.inspectSchema()`
- **THEN** it MUST render or list the provided nodes and edges without changing their identifiers, labels, or types

### Requirement: Inspector exposes selected-node detail

The system MUST expose read-only detail for a selected graph node using the editor inspection contract.

#### Scenario: Selecting a graph node

- **WHEN** a user selects a buffer, layout, bind group, shader, pipeline, pass, or render graph node
- **THEN** the inspector MUST show the detail properties returned by the editor layer for that node

### Requirement: Inspector remains separate from runtime execution

The system MUST keep schema inspection separate from preview runtime execution.

#### Scenario: Inspecting without WebGPU execution

- **WHEN** the inspector displays schema summary, graph, and node detail
- **THEN** it MUST NOT require a `GPUDevice`, command encoder, simulation runner, or running preview loop

### Requirement: Inspector is read-only

The system MUST NOT modify schema content, schema files, runtime resources, or persisted state from the inspector surface.

#### Scenario: Interacting with inspector controls

- **WHEN** a user navigates graph nodes or changes the selected node
- **THEN** the underlying `WebGpuSimulationSchema` MUST remain unchanged

### Requirement: Editor graph mapping is tested

The system MUST include tests that lock the editor graph mapping for representative schema input.

#### Scenario: Testing PBF inspection output

- **WHEN** tests inspect the PBF schema
- **THEN** they MUST verify stable graph nodes, edges, summary data, and representative node details
