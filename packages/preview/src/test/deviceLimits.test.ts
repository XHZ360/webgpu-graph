import { describe, expect, it } from "vitest";
import {
  createBindGroupLayoutSchema,
  createBindingSchema,
  createStorageBufferSchema,
  createUniformBufferSchema,
  SHADER_STAGE,
  type WebGpuSimulationSchema,
} from "schema";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";
import { getRequiredDeviceLimits } from "../deviceLimits.ts";

function createMinimalSchema(): WebGpuSimulationSchema {
  return {
    name: "minimal",
    version: "1.0.0",
    buffers: {
      positions: createStorageBufferSchema("positions", 16),
      simParams: createUniformBufferSchema("simParams", 16),
    },
    bindGroupLayouts: {
      shared: createBindGroupLayoutSchema("shared", [
        createBindingSchema(0, "positions", "buffer", SHADER_STAGE.COMPUTE),
        createBindingSchema(1, "simParams", "buffer", SHADER_STAGE.COMPUTE),
      ]),
    },
    bindGroups: {},
    shaders: {},
    pipelines: {
      main: {
        name: "main",
        type: "compute",
        shader: "shader-main",
        bindGroups: [{ group: 0, layout: "shared" }],
      },
    },
    passes: {},
    renderGraphs: {},
    mainGraphRef: "main",
  };
}

describe("getRequiredDeviceLimits", () => {
  it("returns an empty object when the schema fits default limits", () => {
    expect(getRequiredDeviceLimits(createMinimalSchema())).toEqual({});
  });

  it("derives maxStorageBuffersPerShaderStage for the PBF schema", () => {
    expect(getRequiredDeviceLimits(createPbfSimulationSchema())).toEqual({
      maxStorageBuffersPerShaderStage: 9,
    });
  });
});
