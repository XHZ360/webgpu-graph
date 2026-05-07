import { describe, expect, it, vi } from "vitest";
import type { GraphExecutorOptions } from "../graphExecutor.ts";
import { GraphExecutor } from "../graphExecutor.ts";
import type { WebGpuSimulationSchema, SchemaExecutionContext } from "schema";

function createComputePipeline(label: string): GPUComputePipeline {
  return { label } as GPUComputePipeline;
}

function createBindGroup(label: string): GPUBindGroup {
  return { label } as GPUBindGroup;
}

function createMockCommandEncoder(log: string[]): GPUCommandEncoder {
  return {
    beginComputePass() {
      return {
        setPipeline(pipeline: GPUComputePipeline) {
          log.push(`pipeline:${(pipeline as { label?: string }).label ?? "unknown"}`);
        },
        setBindGroup(group: number, bindGroup: GPUBindGroup) {
          log.push(`bind:${group}:${(bindGroup as { label?: string }).label ?? "unknown"}`);
        },
        dispatchWorkgroups(x: number, y?: number, z?: number) {
          log.push(`dispatch:${x},${y ?? 1},${z ?? 1}`);
        },
        end() {
          log.push("end");
        },
      } as GPUComputePassEncoder;
    },
  } as GPUCommandEncoder;
}

function createSchema(): WebGpuSimulationSchema {
  return {
    name: "Test",
    version: "1.0.0",
    buffers: {},
    bindGroupLayouts: {},
    bindGroups: {
      "bg-main": {
        name: "bg-main",
        layout: "layout-main",
        bindings: [],
      },
    },
    shaders: {
      "shader-a": { name: "shader-a", source: "", entryPoint: "main" },
      "shader-b": { name: "shader-b", source: "", entryPoint: "main" },
      "shader-c": { name: "shader-c", source: "", entryPoint: "main" },
    },
    pipelines: {
      "pipeline-a": { name: "pipeline-a", type: "compute", shader: "shader-a", bindGroups: [] },
      "pipeline-b": { name: "pipeline-b", type: "compute", shader: "shader-b", bindGroups: [] },
      "pipeline-c": { name: "pipeline-c", type: "compute", shader: "shader-c", bindGroups: [] },
    },
    passes: {
      "pass-a": {
        name: "pass-a",
        type: "compute",
        pipelineRef: "pipeline-a",
        bindGroups: [{ group: 0, bindGroupRef: "bg-main" }],
        dispatch: 1,
      },
      "pass-b": {
        name: "pass-b",
        type: "compute",
        pipelineRef: "pipeline-b",
        bindGroups: [{ group: 0, bindGroupRef: "bg-main" }],
        dispatch: 2,
      },
      "pass-c": {
        name: "pass-c",
        type: "compute",
        pipelineRef: "pipeline-c",
        bindGroups: [{ group: 0, bindGroupRef: "bg-main" }],
        dispatch: 3,
      },
    },
    renderGraphs: {
      main: {
        name: "main",
        nodes: [
          { name: "start", passRef: "pass-a" },
          {
            name: "loop",
            kind: "subgraph",
            graphRef: "iteration",
            iterations: { param: "iterationCount" },
            dependencies: ["start"],
          },
          { name: "finish", passRef: "pass-c", dependencies: ["loop"] },
        ],
      },
      iteration: {
        name: "iteration",
        nodes: [{ name: "iter-pass", passRef: "pass-b" }],
      },
    },
    mainGraphRef: "main",
  };
}

function createExecutor(schema: WebGpuSimulationSchema): GraphExecutor {
  const options: GraphExecutorOptions = {
    schema,
    computePipelines: new Map([
      ["pipeline-a", createComputePipeline("pipeline-a")],
      ["pipeline-b", createComputePipeline("pipeline-b")],
      ["pipeline-c", createComputePipeline("pipeline-c")],
    ]),
    bindGroups: new Map([["bg-main", createBindGroup("bg-main")]]),
  };
  return new GraphExecutor(options);
}

describe("GraphExecutor", () => {
  it("executes subgraph nodes for the requested iteration count", () => {
    const log: string[] = [];
    const executor = createExecutor(createSchema());
    const context: SchemaExecutionContext = {
      params: { iterationCount: 3 },
      evaluateDispatch: vi.fn(),
      reportError: vi.fn(),
    };

    executor.execute(createMockCommandEncoder(log), context);

    expect(log).toEqual([
      "pipeline:pipeline-a",
      "bind:0:bg-main",
      "dispatch:1,1,1",
      "end",
      "pipeline:pipeline-b",
      "bind:0:bg-main",
      "dispatch:2,1,1",
      "end",
      "pipeline:pipeline-b",
      "bind:0:bg-main",
      "dispatch:2,1,1",
      "end",
      "pipeline:pipeline-b",
      "bind:0:bg-main",
      "dispatch:2,1,1",
      "end",
      "pipeline:pipeline-c",
      "bind:0:bg-main",
      "dispatch:3,1,1",
      "end",
    ]);
  });

  it("reports and falls back when the iteration param is missing", () => {
    const log: string[] = [];
    const reportError = vi.fn();
    const executor = createExecutor(createSchema());
    const context: SchemaExecutionContext = {
      params: {},
      evaluateDispatch: vi.fn(),
      reportError,
    };

    executor.execute(createMockCommandEncoder(log), context);

    expect(reportError).toHaveBeenCalledWith(
      'Render subgraph iteration requested but no numeric param named "iterationCount" was provided. Falling back to 1 iteration.',
    );
    expect(log.filter((entry) => entry === "pipeline:pipeline-b")).toHaveLength(1);
  });
});
