# Schema Model Specification

## Purpose

The schema model defines static, declarative structures for describing WebGPU simulations. It is the core exchange format shared by validation, factories, visualization, editor inspection, and runtime preview.

## Requirements

### Requirement: Schema model is layered

The schema model MUST be organized as layered structures from basic resources up to simulation-level aggregation.

#### Scenario: Building a simulation schema

- **GIVEN** a simulation needs to describe GPU work
- **WHEN** the schema is assembled
- **THEN** it MUST compose lower-level resources into buffers, bindings, shaders, pipelines, passes, render graphs, and a top-level simulation object

### Requirement: Buffers describe GPU memory resources

Buffer schemas MUST describe named GPU memory resources with size, usage, abstract type, optional content typing, optional initial data, and optional mapping intent.

#### Scenario: Referencing a buffer from bindings

- **GIVEN** a binding references a buffer resource
- **WHEN** validation or graph conversion resolves that reference
- **THEN** the buffer name MUST identify a declared buffer in the simulation schema

### Requirement: Binding layout and group instance are separate

Bind group layouts MUST define resource slots, while bind groups MUST define concrete resource bindings for a layout.

#### Scenario: Reusing a bind group layout

- **GIVEN** one layout can be used by multiple pipelines
- **WHEN** a pipeline references that layout
- **THEN** the pipeline MUST assign the layout to an explicit `group` instead of requiring the layout itself to carry `group`

### Requirement: Pipelines map layouts to explicit groups

Pipeline schemas MUST reference shader stages and bind group layouts through explicit `group` mappings.

#### Scenario: Creating a pipeline layout

- **GIVEN** a pipeline has multiple bind group layout references
- **WHEN** the pipeline layout is assembled
- **THEN** layouts MUST be ordered and validated by their explicit `group` values

### Requirement: Passes bind concrete groups for execution

Pass schemas MUST identify the pipeline to execute and the concrete bind groups to bind for that pass.

#### Scenario: Executing a compute pass

- **GIVEN** a compute pass references a pipeline and bind groups
- **WHEN** the pass is executed
- **THEN** each bind group MUST be bound at the pass-declared `group` before dispatch

### Requirement: Dispatch supports static values and explicit expressions

Compute dispatch MUST support static numeric values or tuples, and MAY support explicit expression objects when the caller provides an evaluation context.

#### Scenario: Evaluating dispatch expression

- **GIVEN** a compute pass uses `dispatch: { expr }`
- **WHEN** execution needs the dispatch size
- **THEN** expression evaluation MUST be delegated to caller-provided context rather than an implicit parser in schema core

### Requirement: Render graphs describe pass order and resource semantics

Render graph schemas MUST describe pass nodes, dependencies, and optional resource read/write semantics.

#### Scenario: Ordering graph execution

- **GIVEN** a render graph contains nodes with dependencies
- **WHEN** runtime execution prepares node order
- **THEN** graph dependencies MUST provide the basis for ordering analysis

### Requirement: Simulation schema is the top-level exchange object

`WebGpuSimulationSchema` MUST aggregate buffers, layouts, bind groups, shaders, pipelines, passes, render graphs, and `mainGraphRef` into one shared object.

#### Scenario: Editor and preview share input

- **GIVEN** editor inspection and runtime preview operate on the same simulation
- **WHEN** they receive input
- **THEN** both SHOULD use the same `WebGpuSimulationSchema` structure as their source data
