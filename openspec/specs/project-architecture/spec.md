# Project Architecture Specification

## Purpose

`webgpu-graph` MUST be organized around a declaration-first WebGPU workflow. The project uses `schema` as the shared source of truth for GPU resources, bindings, pipelines, passes, render graphs, and simulation descriptions.

## Requirements

### Requirement: Schema package owns model rules

The `schema` package MUST define the canonical data model, validation rules, factories, serialization-oriented structures, and visualization-oriented summaries used by the rest of the monorepo.

#### Scenario: Downstream packages consume schema

- **GIVEN** `editor` or `preview` needs to understand a simulation
- **WHEN** it reads simulation structure
- **THEN** it MUST consume the shared schema model instead of redefining schema rules locally

### Requirement: Runtime and editing packages remain downstream

The `preview` and `editor` packages MUST consume schema definitions and MUST NOT become sources of schema model rules.

#### Scenario: Runtime preview executes a graph

- **GIVEN** a valid `WebGpuSimulationSchema`
- **WHEN** `preview` creates resources or executes graph nodes
- **THEN** it MUST use schema-provided structure as input and keep runtime behavior separate from model definition

#### Scenario: Editor prepares graph data

- **GIVEN** a valid `WebGpuSimulationSchema`
- **WHEN** `editor` inspects it for UI-facing data
- **THEN** it MUST derive summaries, Mermaid output, and graph nodes from schema data without changing the schema contract

### Requirement: Documentation distinguishes target spec from implementation state

Project documentation MUST distinguish target specifications from currently implemented public exports.

#### Scenario: A documented API is not fully implemented

- **GIVEN** a docs page describes a target capability
- **WHEN** the capability is not exported from the package entrypoint
- **THEN** the docs MUST treat it as target specification rather than confirmed implementation

### Requirement: Current implementation priority is compute-first

The current implementation path MUST prioritize the compute-oriented minimal loop before broad WebGPU feature coverage.

#### Scenario: Selecting near-term implementation work

- **GIVEN** schema, preview, editor, or website work is being planned
- **WHEN** scope must be chosen
- **THEN** the path SHOULD favor the `Buffer -> BindGroup -> ComputePipeline -> ComputePass -> RenderGraph` loop before full render, texture, sampler, or advanced editor coverage
