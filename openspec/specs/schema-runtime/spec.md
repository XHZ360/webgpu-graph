# Schema Runtime Specification

## Purpose

The runtime-oriented schema capabilities cover construction, validation, resource creation, graph execution support, capability negotiation, and visualization helpers around the shared schema model.

## Requirements

### Requirement: Builder creates schema objects progressively

The schema package MUST provide builder utilities for incrementally assembling simulation schemas with less object-construction boilerplate.

#### Scenario: Building a simulation from parts

- **GIVEN** callers add buffers, layouts, bind groups, shaders, pipelines, passes, and graphs
- **WHEN** the builder finalizes the schema
- **THEN** it SHOULD return a top-level simulation schema with name and version metadata

### Requirement: Validator checks structural consistency

The schema package MUST provide validation for structural consistency and reference integrity.

#### Scenario: Validating schema references

- **GIVEN** a schema references resources, layouts, bind groups, shaders, pipelines, passes, and graphs by name
- **WHEN** validation runs
- **THEN** missing or inconsistent references MUST be reported as validation errors

#### Scenario: Validating graph and binding constraints

- **GIVEN** a schema contains render graph dependencies and pipeline/pass bind group mappings
- **WHEN** validation runs
- **THEN** cycles, duplicate pipeline groups, layout mismatches, and invalid dispatch expression shapes SHOULD be detected where supported by the implementation

### Requirement: Factory creates WebGPU resources from schema

The schema package MUST provide factory utilities that translate schema definitions into concrete WebGPU resources.

#### Scenario: Creating resources for preview

- **GIVEN** a schema and `GPUDevice`
- **WHEN** factory resource creation runs
- **THEN** it SHOULD create buffers, bind group layouts, bind groups, shader modules, and compute or render pipelines covered by the implemented schema subset

### Requirement: Preview derives required device limits from schema

The preview layer MUST derive schema-specific device limits before host device creation when the required information can be inferred statically.

#### Scenario: Storage buffers exceed WebGPU defaults

- **GIVEN** a schema uses more storage buffers per shader stage than the default supported limit
- **WHEN** the host requests a `GPUDevice`
- **THEN** preview-derived `requiredLimits` SHOULD be passed by the host instead of hard-coding example-specific limit knowledge in demo code

### Requirement: Preview executes compute-oriented render graphs

The preview layer MUST support the compute-first schema loop by creating resources and dispatching graph nodes through WebGPU command encoders.

#### Scenario: Stepping a simulation

- **GIVEN** a schema, initialized resources, and a command encoder
- **WHEN** preview steps the simulation
- **THEN** it SHOULD bind compute pipelines and bind groups, resolve dispatch values, and emit a `GPUCommandBuffer`

### Requirement: Schema supports visualization and summary helpers

The schema package MUST support visualization-oriented outputs for editor and documentation consumers.

#### Scenario: Inspecting schema for editor display

- **GIVEN** a simulation schema
- **WHEN** editor inspection runs
- **THEN** it SHOULD derive structural summary, Mermaid graph output, and graph node/edge data from schema content
