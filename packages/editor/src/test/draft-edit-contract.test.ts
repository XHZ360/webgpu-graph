import { describe, expect, it } from "vitest";
import { applyEditorOperation, createEditorDraftSession, type EditorOperation } from "editor";
import {
  createBindGroupLayoutSchema,
  createBindingSchema,
  createStorageBufferSchema,
  createUniformBufferSchema,
  DefaultSchemaBuilder,
  SHADER_STAGE,
  type ComputePassSchema,
  type ComputePipelineSchema,
  type RenderGraphSchema,
  type ShaderSchema,
  type WebGpuSimulationSchema,
} from "schema";

function buildMinimalSchema(): WebGpuSimulationSchema {
  return new DefaultSchemaBuilder()
    .addBuffer(createStorageBufferSchema("positions", 1200))
    .addBuffer(createUniformBufferSchema("params", 64))
    .addBindGroupLayout(
      createBindGroupLayoutSchema("layout-main", [
        createBindingSchema(0, "positions", "buffer", SHADER_STAGE.COMPUTE),
        createBindingSchema(1, "params", "buffer", SHADER_STAGE.COMPUTE),
      ]),
    )
    .addBindGroup({
      name: "bg-main",
      layout: "layout-main",
      bindings: [
        { binding: 0, resourceRef: "positions" },
        { binding: 1, resourceRef: "params" },
      ],
    })
    .addShader({
      name: "sim-shader",
      source: "@compute fn main() {}",
      entryPoint: "main",
    } satisfies ShaderSchema)
    .addPipeline({
      name: "sim-pipeline",
      type: "compute",
      shader: "sim-shader",
      bindGroups: [{ group: 0, layout: "layout-main" }],
    } satisfies ComputePipelineSchema)
    .addPass(createComputePass("sim-pass"))
    .addRenderGraph({
      name: "main-graph",
      nodes: [{ name: "node-0", passRef: "sim-pass" }],
    } satisfies RenderGraphSchema)
    .build("Test", "1.0.0");
}

function createComputePass(name: string): ComputePassSchema {
  return {
    name,
    type: "compute",
    pipelineRef: "sim-pipeline",
    bindGroups: [{ group: 0, bindGroupRef: "bg-main" }],
    dispatch: [64, 1, 1],
  };
}

describe("editor draft edit contract", () => {
  it("creates a validated draft without mutating the input schema", () => {
    const schema = buildMinimalSchema();
    const session = createEditorDraftSession(schema);

    const result = applyEditorOperation(session, {
      kind: "updateBuffer",
      name: "positions",
      patch: { size: 2400 },
    });

    expect(result.ok).toBe(true);
    expect(result.session.draft.buffers.positions.size).toBe(2400);
    expect(schema.buffers.positions.size).toBe(1200);
    expect(result.session.draft).not.toBe(schema);
    expect(result.session.dirty).toBe(true);
    expect(result.session.validation.status).toBe("valid");
  });

  it("returns UI-ready selection and validation state", () => {
    const session = createEditorDraftSession(buildMinimalSchema());

    const result = applyEditorOperation(session, {
      kind: "selectEntity",
      id: "buffer:positions",
      entityType: "buffer",
    });

    expect(result.ok).toBe(true);
    expect(result.session).toMatchObject({
      selectedId: "buffer:positions",
      selectedType: "buffer",
      dirty: false,
      validation: { status: "valid", diagnostics: [] },
    });
  });

  it("fails invalid and unsupported operations without mutating the prior session", () => {
    const session = createEditorDraftSession(buildMinimalSchema());

    const duplicate = applyEditorOperation(session, {
      kind: "createBuffer",
      name: "positions",
      buffer: createStorageBufferSchema("positions", 1200),
    });
    const unsupported = applyEditorOperation(session, {
      kind: "unknownOperation",
    } as unknown as EditorOperation);

    expect(duplicate.ok).toBe(false);
    expect(duplicate.session).toBe(session);
    expect(duplicate.diagnostics[0]).toMatchObject({ rule: "EDITOR_OPERATION" });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.session).toBe(session);
    expect(session.draft.buffers.positions.size).toBe(1200);
  });

  it("applies representative CRUD for buffers, passes, and render graph nodes", () => {
    let session = createEditorDraftSession(buildMinimalSchema());

    const createBuffer = applyEditorOperation(session, {
      kind: "createBuffer",
      name: "scratch",
      buffer: createStorageBufferSchema("scratch", 256),
    });
    expect(createBuffer.ok).toBe(true);
    session = createBuffer.session;

    const updateBuffer = applyEditorOperation(session, {
      kind: "updateBuffer",
      name: "scratch",
      patch: { size: 512 },
    });
    expect(updateBuffer.ok).toBe(true);
    expect(updateBuffer.session.draft.buffers.scratch.size).toBe(512);
    session = updateBuffer.session;

    const deleteBuffer = applyEditorOperation(session, { kind: "deleteBuffer", name: "scratch" });
    expect(deleteBuffer.ok).toBe(true);
    expect(deleteBuffer.session.draft.buffers.scratch).toBeUndefined();
    session = deleteBuffer.session;

    const createPass = applyEditorOperation(session, {
      kind: "createPass",
      name: "sim-pass-2",
      pass: createComputePass("sim-pass-2"),
    });
    expect(createPass.ok).toBe(true);
    session = createPass.session;

    const updatePass = applyEditorOperation(session, {
      kind: "updatePass",
      name: "sim-pass-2",
      patch: { dispatch: [32, 1, 1] },
    });
    expect(updatePass.ok).toBe(true);
    expect(updatePass.session.draft.passes["sim-pass-2"]).toMatchObject({ dispatch: [32, 1, 1] });
    session = updatePass.session;

    const addNode = applyEditorOperation(session, {
      kind: "addRenderGraphNode",
      graphName: "main-graph",
      node: { name: "node-1", passRef: "sim-pass-2" },
    });
    expect(addNode.ok).toBe(true);
    session = addNode.session;

    const updateNode = applyEditorOperation(session, {
      kind: "updateRenderGraphNode",
      graphName: "main-graph",
      nodeName: "node-1",
      patch: { dependencies: ["node-0"] },
    });
    expect(updateNode.ok).toBe(true);
    expect(updateNode.session.draft.renderGraphs["main-graph"].nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "node-1", dependencies: ["node-0"] }),
      ]),
    );
    session = updateNode.session;

    const removeNode = applyEditorOperation(session, {
      kind: "removeRenderGraphNode",
      graphName: "main-graph",
      nodeName: "node-1",
    });
    expect(removeNode.ok).toBe(true);
    session = removeNode.session;

    const deletePass = applyEditorOperation(session, { kind: "deletePass", name: "sim-pass-2" });
    expect(deletePass.ok).toBe(true);
    expect(deletePass.session.draft.passes["sim-pass-2"]).toBeUndefined();
    expect(deletePass.session.validation.status).toBe("valid");
  });

  it("hands edited drafts to DefaultSchemaValidator and exposes diagnostics", () => {
    const session = createEditorDraftSession(buildMinimalSchema());

    const result = applyEditorOperation(session, {
      kind: "updatePass",
      name: "sim-pass",
      patch: { pipelineRef: "missing-pipeline" },
    });

    expect(result.ok).toBe(true);
    expect(result.session.validation.status).toBe("invalid");
    expect(result.session.validation.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: "MISSING_REF" })]),
    );
    expect(result.diagnostics).toEqual(result.session.validation.diagnostics);
  });
});
