## Context

`schema` already exports visualization helpers for Mermaid output and structural summaries. `editor` already turns a `WebGpuSimulationSchema` into graph nodes, edges, and node details through `inspectSchema()` and `getNodeDetail()`. `website` currently mounts the PBF runtime demo directly and does not expose editor inspection data.

The first visualization/designer milestone should prove the schema-to-inspector path before adding editable graph semantics. This keeps `schema` as the source of truth, preserves the model/runtime split, and gives future designer work a tested data contract.

## Goals / Non-Goals

**Goals:**

- Provide a read-only inspector surface for the current PBF schema.
- Strengthen `editor` graph mapping behavior with tests.
- Reuse `schema/visualization` and `editor.inspectSchema()` rather than introducing a parallel graph model.
- Keep the inspector separate from `preview` runtime execution.

**Non-Goals:**

- No drag/drop graph editing.
- No schema persistence or import/export changes.
- No new runtime execution behavior.
- No external graph canvas dependency in the first slice.
- No custom node extension API.

## Decisions

### Decision: Start with a read-only inspector

The first UI surface will display graph, summary, and selected-node detail without allowing edits.

Alternatives considered:

- Full designer first: rejected because editing semantics, validation UX, and persistence format are not yet specified.
- Runtime preview first: rejected because `preview` already has a PBF demo and should stay downstream from schema/editor inspection.

### Decision: Use `editor` DTOs as the UI contract

The website inspector should consume `SchemaInspection`, `GraphData`, `EditorNode`, and `EditorEdge` from `editor` instead of deriving graph data directly from schema objects.

Alternatives considered:

- Build graph data inside `website`: rejected because it duplicates editor responsibilities.
- Store layout state in schema: rejected for this slice because layout/editing state is not part of the current schema contract.

### Decision: Keep visualization dependency-free for the first slice

The first inspector should use simple DOM/SVG or existing Mermaid text data rather than adding React Flow, Rete, or a canvas graph library.

Alternatives considered:

- Add a graph editor library immediately: rejected because the project has a vanilla TypeScript website and no component framework today.
- Use Canvas for graph rendering: deferred because the initial value is inspection and contract validation, not interactive graph manipulation.

### Decision: Use the PBF schema as the first target

The PBF schema already exercises buffers, layouts, bind groups, shaders, pipelines, passes, render graphs, and subgraphs. It is the richest existing example and gives the inspector a realistic graph.

Alternatives considered:

- Add a synthetic sample schema: useful for unit tests, but insufficient as the first user-facing demonstration.
- Start with an empty schema: rejected because it does not validate meaningful graph behavior.

## Risks / Trade-offs

- [Risk] Users may expect editing from a designer-labeled feature -> Mitigation: call the first milestone an inspector and document edit operations as non-goals.
- [Risk] Main-graph-only visualization may hide subgraph complexity -> Mitigation: tests should cover PBF graph/subgraph detail and the UI should make graph boundaries explicit.
- [Risk] Website DOM code may grow too large -> Mitigation: keep inspector rendering in a dedicated module instead of expanding `main.ts` or `pbfDemo.ts`.
- [Risk] Future graph library adoption could replace the first renderer -> Mitigation: keep `editor` DTOs as the stable boundary so UI rendering remains swappable.
