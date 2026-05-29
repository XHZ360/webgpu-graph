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
  PBF_GRID_HEIGHT,
  PBF_GRID_WIDTH,
  PBF_MAX_PARTICLES_PER_CELL,
  PBF_SIMULATION_METADATA,
  PBF_WORKGROUP_SIZE,
  pbfSimulationSchema,
} from "schema/examples/pbf-simulation";

const WORLD_SIZE = { x: 80, y: 40 };
const SURFACE_KERNEL_RADIUS = 2.4;
const SURFACE_THRESHOLD = 0.45;
const GRID_CELL_SIZE = WORLD_SIZE.x / PBF_GRID_WIDTH;

const gridShaders = `
struct Vec2Buffer {
  data: array<vec2<f32>>,
}

struct U32Buffer {
  data: array<u32>,
}

struct AtomicU32Buffer {
  data: array<atomic<u32>>,
}

@group(0) @binding(0) var<storage, read> positions: Vec2Buffer;
@group(0) @binding(1) var<storage, read_write> gridCounts: AtomicU32Buffer;
@group(0) @binding(2) var<storage, read_write> grid2Particles: U32Buffer;

fn inGrid(cell: vec2<i32>) -> bool {
  return cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < ${PBF_GRID_WIDTH} &&
    cell.y < ${PBF_GRID_HEIGHT};
}

fn cellFromPos(pos: vec2<f32>) -> vec2<i32> {
  return vec2<i32>(floor(pos / ${GRID_CELL_SIZE}));
}

fn flatCellIndex(cell: vec2<i32>) -> u32 {
  return u32(cell.y) * ${PBF_GRID_WIDTH}u + u32(cell.x);
}

fn gridSlotIndex(cellIndex: u32, slot: u32) -> u32 {
  return cellIndex * ${PBF_MAX_PARTICLES_PER_CELL}u + slot;
}

@compute @workgroup_size(${PBF_WORKGROUP_SIZE})
fn clear_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${PBF_GRID_WIDTH * PBF_GRID_HEIGHT}u) { return; }

  atomicStore(&gridCounts.data[i], 0u);
}

@compute @workgroup_size(${PBF_WORKGROUP_SIZE})
fn build_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= ${PBF_NUM_PARTICLES}u) { return; }

  let cell = cellFromPos(positions.data[i]);
  if (!inGrid(cell)) { return; }

  let cellIndex = flatCellIndex(cell);
  let slot = atomicAdd(&gridCounts.data[cellIndex], 1u);
  if (slot < ${PBF_MAX_PARTICLES_PER_CELL}u) {
    grid2Particles.data[gridSlotIndex(cellIndex, slot)] = i;
  }
}
`;

const surfaceShaders = `
struct Vec2Buffer {
  data: array<vec2<f32>>,
}

struct U32Buffer {
  data: array<u32>,
}

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) world : vec2f,
}

@group(0) @binding(0) var<storage, read> positions: Vec2Buffer;
@group(0) @binding(1) var<storage, read> gridCounts: U32Buffer;
@group(0) @binding(2) var<storage, read> grid2Particles: U32Buffer;

fn inGrid(cell: vec2<i32>) -> bool {
  return cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < ${PBF_GRID_WIDTH} &&
    cell.y < ${PBF_GRID_HEIGHT};
}

fn cellFromPos(pos: vec2<f32>) -> vec2<i32> {
  return vec2<i32>(floor(pos / ${GRID_CELL_SIZE}));
}

fn flatCellIndex(cell: vec2<i32>) -> u32 {
  return u32(cell.y) * ${PBF_GRID_WIDTH}u + u32(cell.x);
}

fn gridSlotIndex(cellIndex: u32, slot: u32) -> u32 {
  return cellIndex * ${PBF_MAX_PARTICLES_PER_CELL}u + slot;
}

fn gridCountAt(cellIndex: u32) -> u32 {
  return min(gridCounts.data[cellIndex], ${PBF_MAX_PARTICLES_PER_CELL}u);
}

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
  let centerCell = cellFromPos(fragData.world);

  for (var oy = -1; oy <= 1; oy += 1) {
    for (var ox = -1; ox <= 1; ox += 1) {
      let cell = centerCell + vec2<i32>(ox, oy);
      if (!inGrid(cell)) { continue; }

      let cellIndex = flatCellIndex(cell);
      let cellCount = gridCountAt(cellIndex);
      for (var slot = 0u; slot < cellCount; slot += 1u) {
        let particleIndex = grid2Particles.data[gridSlotIndex(cellIndex, slot)];
        let delta = fragData.world - positions.data[particleIndex];
        let distanceValue = length(delta);
        if (distanceValue < ${SURFACE_KERNEL_RADIUS}) {
          let normalized = 1.0 - distanceValue / ${SURFACE_KERNEL_RADIUS};
          density += normalized * normalized * normalized;
        }
      }
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

let activeRunId = 0;
let stopCurrentRun: (() => void) | null = null;

export function stop() {
  activeRunId += 1;
  stopCurrentRun?.();
  stopCurrentRun = null;
}

export async function run() {
  stopCurrentRun?.();
  const runId = activeRunId + 1;
  activeRunId = runId;
  let stopped = false;
  let animationFrame = 0;
  let device: GPUDevice | null = null;
  let runner: SimulationRunner | null = null;

  const stopRun = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(animationFrame);
    runner?.dispose();
    device?.destroy();
  };

  stopCurrentRun = stopRun;

  device = await requestDevice(getRequiredDeviceLimits(pbfSimulationSchema) as GPUSupportedLimits);
  if (stopped || activeRunId !== runId) {
    device.destroy();
    return;
  }

  const simulationContext = createDispatchExecutionContext({
    params: {
      pbfIterations: PBF_SIMULATION_METADATA.pbfIterations,
    },
    reportError: (message) => console.error(message),
  });
  runner = new SimulationRunner({
    schema: pbfSimulationSchema,
    device,
    context: simulationContext,
  });
  runner.initialize();

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
  const gridCountsBuffer = runner.getBuffer("gridCounts");
  if (!gridCountsBuffer) throw new Error('PBF buffer "gridCounts" not found.');
  const grid2ParticlesBuffer = runner.getBuffer("grid2Particles");
  if (!grid2ParticlesBuffer) throw new Error('PBF buffer "grid2Particles" not found.');

  const gridBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ],
  });
  const gridBindGroup = device.createBindGroup({
    layout: gridBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: positionsBuffer },
      },
      {
        binding: 1,
        resource: { buffer: gridCountsBuffer },
      },
      {
        binding: 2,
        resource: { buffer: grid2ParticlesBuffer },
      },
    ],
  });
  const gridShaderModule = device.createShaderModule({
    code: gridShaders,
  });
  const gridPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [gridBindGroupLayout],
  });
  const clearGridPipeline = device.createComputePipeline({
    layout: gridPipelineLayout,
    compute: {
      module: gridShaderModule,
      entryPoint: "clear_grid",
    },
  });
  const buildGridPipeline = device.createComputePipeline({
    layout: gridPipelineLayout,
    compute: {
      module: gridShaderModule,
      entryPoint: "build_grid",
    },
  });

  const surfaceBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
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
      {
        binding: 1,
        resource: { buffer: gridCountsBuffer },
      },
      {
        binding: 2,
        resource: { buffer: grid2ParticlesBuffer },
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

  const clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 0.0 };
  if (!device || !runner) {
    throw new Error("Failed to initialize liquid bottle renderer.");
  }
  const gpuDevice = device;
  const simulationRunner = runner;

  function frame() {
    if (stopped || activeRunId !== runId) return;

    const commandEncoder = gpuDevice.createCommandEncoder();
    const simCommands = simulationRunner.step();

    const gridPassEncoder = commandEncoder.beginComputePass();
    gridPassEncoder.setBindGroup(0, gridBindGroup);
    gridPassEncoder.setPipeline(clearGridPipeline);
    gridPassEncoder.dispatchWorkgroups(
      Math.ceil((PBF_GRID_WIDTH * PBF_GRID_HEIGHT) / PBF_WORKGROUP_SIZE),
    );
    gridPassEncoder.setPipeline(buildGridPipeline);
    gridPassEncoder.dispatchWorkgroups(Math.ceil(PBF_NUM_PARTICLES / PBF_WORKGROUP_SIZE));
    gridPassEncoder.end();

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

    gpuDevice.queue.submit([simCommands, commandEncoder.finish()]);
    animationFrame = requestAnimationFrame(frame);
  }

  frame();
}
