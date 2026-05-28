/// <reference types="@webgpu/types" />
import {
  createDispatchExecutionContext,
  getRequiredDeviceLimits,
  requestDevice,
  SimulationRunner,
} from "preview";
import {
  createPbfInitialParticleState,
  packPbfSimulationParams,
  PBF_NUM_PARTICLES,
  PBF_SIMULATION_METADATA,
  pbfSimulationSchema,
} from "schema/examples/pbf-simulation";

const WORLD_SIZE = { x: 80, y: 40 };
const SURFACE_KERNEL_RADIUS = 2.4;
const SURFACE_THRESHOLD = 0.45;

const surfaceShaders = `
struct Vec2Buffer {
  data: array<vec2<f32>>,
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) world : vec2f,
}

@group(0) @binding(0) var<storage, read> positions: Vec2Buffer;

@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut
{
  let corners = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );
  let clip = corners[vertexIndex];

  var output : VertexOut;
  output.position = vec4f(clip, 0.0, 1.0);
  output.world = vec2f(
    (clip.x + 1.0) * 0.5 * ${WORLD_SIZE.x}.0,
    (clip.y + 1.0) * 0.5 * ${WORLD_SIZE.y}.0,
  );
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
{
  var density = 0.0;

  for (var particleIndex = 0u; particleIndex < ${PBF_NUM_PARTICLES}u; particleIndex += 1u) {
    let delta = fragData.world - positions.data[particleIndex];
    let distanceValue = length(delta);
    if (distanceValue < ${SURFACE_KERNEL_RADIUS}) {
      let normalized = 1.0 - distanceValue / ${SURFACE_KERNEL_RADIUS};
      density += normalized * normalized * normalized;
    }
  }

  let alpha = smoothstep(${SURFACE_THRESHOLD - 0.08}, ${SURFACE_THRESHOLD + 0.08}, density);
  if (alpha <= 0.01) {
    discard;
  }

  let edge = 1.0 - smoothstep(${SURFACE_THRESHOLD + 0.04}, ${SURFACE_THRESHOLD + 0.22}, density);
  let base = vec3f(0.02, 0.36, 0.9);
  let highlight = vec3f(0.36, 0.82, 1.0);
  return vec4f(mix(base, highlight, edge * 0.45), alpha);
}
`;

let stopCurrentRun: (() => void) | null = null;

export async function run() {
  stopCurrentRun?.();
  let stopped = false;
  let animationFrame = 0;

  const device = await requestDevice(
    getRequiredDeviceLimits(pbfSimulationSchema) as GPUSupportedLimits,
  );
  const simulationContext = createDispatchExecutionContext({
    params: {
      pbfIterations: PBF_SIMULATION_METADATA.pbfIterations,
    },
    reportError: (message) => console.error(message),
  });
  const runner = new SimulationRunner({
    schema: pbfSimulationSchema,
    device,
    context: simulationContext,
  });
  runner.initialize();

  stopCurrentRun = () => {
    stopped = true;
    cancelAnimationFrame(animationFrame);
    runner.dispose();
  };

  const canvas: HTMLCanvasElement | null = document.querySelector("#liquid-bottle-canvas");
  if (!canvas) throw new Error("Canvas element not found.");

  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));

  const context: GPUCanvasContext | null = canvas.getContext("webgpu");
  if (!context) throw new Error("Unable to acquire WebGPU context from canvas.");
  const gpuContext = context;
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  gpuContext.configure({
    device,
    format: canvasFormat,
    alphaMode: "premultiplied",
  });

  const initialState = createPbfInitialParticleState();
  const simParams = packPbfSimulationParams();
  runner.writeBuffer("positions", initialState.positions);
  runner.writeBuffer("oldPositions", initialState.oldPositions);
  runner.writeBuffer("velocities", initialState.velocities);
  runner.writeBuffer("simParams", simParams);

  const positionsBuffer = runner.getBuffer("positions");
  if (!positionsBuffer) throw new Error('PBF buffer "positions" not found.');

  const surfaceBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
    ],
  });
  const surfaceBindGroup = device.createBindGroup({
    layout: surfaceBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: positionsBuffer },
      },
    ],
  });
  const surfaceShaderModule = device.createShaderModule({
    code: surfaceShaders,
  });
  const surfacePipeline = device.createRenderPipeline({
    vertex: {
      module: surfaceShaderModule,
      entryPoint: "vertex_main",
      buffers: [],
    },
    fragment: {
      module: surfaceShaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: canvasFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
    layout: device.createPipelineLayout({
      bindGroupLayouts: [surfaceBindGroupLayout],
    }),
  });

  const clearColor = { r: 0.0, g: 0.5, b: 1.0, a: 1.0 };

  function frame() {
    if (stopped) return;

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          clearValue: clearColor,
          loadOp: "clear",
          storeOp: "store",
          view: gpuContext.getCurrentTexture().createView(),
        },
      ],
    });

    passEncoder.setPipeline(surfacePipeline);
    passEncoder.setBindGroup(0, surfaceBindGroup);
    passEncoder.draw(3, 1, 0, 0);
    passEncoder.end();

    device.queue.submit([runner.step(), commandEncoder.finish()]);
    animationFrame = requestAnimationFrame(frame);
  }

  frame();
}
