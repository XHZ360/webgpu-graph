/// <reference types="@webgpu/types" />
import {
  createDispatchExecutionContext,
  getRequiredDeviceLimits,
  requestDevice,
  SimulationRunner,
} from "preview";
import {
  createPbfInitialParticleStateFromBoundaryProfile,
  packPbfSimulationParams,
  type PbfBoundaryProfile,
  PBF_NUM_PARTICLES,
  PBF_BOUNDARY_PROFILE_SAMPLE_COUNT,
  PBF_GRID_HEIGHT,
  PBF_GRID_WIDTH,
  PBF_MAX_PARTICLES_PER_CELL,
  PBF_SIMULATION_METADATA,
  PBF_WORKGROUP_SIZE,
  pbfSimulationSchema,
} from "schema/examples/pbf-simulation";

const SVG_VIEWBOX = { width: 1600, height: 900 };
const SVG_TO_WORLD = 0.1;
const WORLD_SIZE = {
  x: SVG_VIEWBOX.width * SVG_TO_WORLD,
  y: SVG_VIEWBOX.height * SVG_TO_WORLD,
};
const SURFACE_KERNEL_RADIUS = 2.4;
const SURFACE_THRESHOLD = 0.45;
const GRID_CELL_SIZE = WORLD_SIZE.x / PBF_GRID_WIDTH;
const BOTTLE_BOUNDARY_PROFILE: PbfBoundaryProfile = createBottleBoundaryProfile();
const BOTTLE_SIMULATION_PARAMS = {
  boundaryMode: 2,
  boundaryX: WORLD_SIZE.x,
  boundaryY: WORLD_SIZE.y,
};

function svgPointToWorld(x: number, y: number): { x: number; y: number } {
  return {
    x: x * SVG_TO_WORLD,
    y: (SVG_VIEWBOX.height - y) * SVG_TO_WORLD,
  };
}

function cubicBezierPoint(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const inverse = 1 - t;
  return (
    inverse * inverse * inverse * p0 +
    3 * inverse * inverse * t * p1 +
    3 * inverse * t * t * p2 +
    t * t * t * p3
  );
}

function cubicXAtY(
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): number {
  let minT = 0;
  let maxT = 1;

  for (let i = 0; i < 18; i += 1) {
    const midT = (minT + maxT) * 0.5;
    const midY = cubicBezierPoint(midT, y0, y1, y2, y3);
    if (midY < y) {
      minT = midT;
    } else {
      maxT = midT;
    }
  }

  return cubicBezierPoint((minT + maxT) * 0.5, x0, x1, x2, x3);
}

function rightBottleBoundarySvgXAtY(y: number): number {
  if (y <= 259) {
    return 910;
  }

  if (y <= 402) {
    return cubicXAtY(y, 910, 259, 910, 317, 931, 364, 973, 402);
  }

  if (y <= 676) {
    return cubicXAtY(y, 973, 402, 1042, 464, 1082, 564, 1082, 676);
  }

  return cubicXAtY(y, 1082, 676, 1082, 733, 1062, 760, 1021, 760);
}

function createBottleBoundaryProfile(): PbfBoundaryProfile {
  const left = new Float32Array(PBF_BOUNDARY_PROFILE_SAMPLE_COUNT);
  const right = new Float32Array(PBF_BOUNDARY_PROFILE_SAMPLE_COUNT);
  const minY = svgPointToWorld(0, 760).y;
  const maxY = svgPointToWorld(0, 220).y;
  const centerX = SVG_VIEWBOX.width * 0.5;

  for (let i = 0; i < PBF_BOUNDARY_PROFILE_SAMPLE_COUNT; i += 1) {
    const t = i / (PBF_BOUNDARY_PROFILE_SAMPLE_COUNT - 1);
    const y = minY + (maxY - minY) * t;
    const svgY = SVG_VIEWBOX.height - y / SVG_TO_WORLD;
    const svgRight = rightBottleBoundarySvgXAtY(svgY);
    const svgLeft = centerX - (svgRight - centerX);
    left[i] = svgPointToWorld(svgLeft, svgY).x;
    right[i] = svgPointToWorld(svgRight, svgY).x;
  }

  return {
    cellCount: PBF_BOUNDARY_PROFILE_SAMPLE_COUNT,
    minY,
    maxY,
    innerMargin: 0.2,
    left,
    right,
  };
}

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

struct SurfaceParams {
  data: array<vec4f, 2>,
}

@group(0) @binding(0) var<storage, read> positions: Vec2Buffer;
@group(0) @binding(1) var<storage, read> gridCounts: U32Buffer;
@group(0) @binding(2) var<storage, read> grid2Particles: U32Buffer;
@group(0) @binding(3) var<uniform> surfaceParams: SurfaceParams;

fn canvasSize() -> vec2f {
  return surfaceParams.data[0].xy;
}

fn coverScale() -> f32 {
  return surfaceParams.data[0].z;
}

fn coverOffset() -> vec2f {
  return surfaceParams.data[1].xy;
}

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
  let pixel = (clip + vec2f(1.0, 1.0)) * 0.5 * canvasSize();
  output.world = (pixel - coverOffset()) / coverScale();
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
  const canvasElement = canvas;

  const context: GPUCanvasContext | null = canvas.getContext("webgpu");
  if (!context) throw new Error("Unable to acquire WebGPU context from canvas.");
  const gpuContext = context;
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  const surfaceParamsBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let surfaceWidth = 0;
  let surfaceHeight = 0;

  function updateSurfaceSize() {
    if (!device) return;

    const rect = canvasElement.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (surfaceWidth === width && surfaceHeight === height) return;

    surfaceWidth = width;
    surfaceHeight = height;
    canvasElement.width = width;
    canvasElement.height = height;

    const coverScale = Math.max(width / WORLD_SIZE.x, height / WORLD_SIZE.y);
    const coverOffsetX = (width - WORLD_SIZE.x * coverScale) * 0.5;
    const coverOffsetY = (height - WORLD_SIZE.y * coverScale) * 0.5;
    device.queue.writeBuffer(
      surfaceParamsBuffer,
      0,
      new Float32Array([width, height, coverScale, 0, coverOffsetX, coverOffsetY, 0, 0]),
    );
  }

  updateSurfaceSize();

  gpuContext.configure({
    device,
    format: canvasFormat,
    alphaMode: "premultiplied",
  });

  const initialState = createPbfInitialParticleStateFromBoundaryProfile(
    BOTTLE_BOUNDARY_PROFILE,
    BOTTLE_SIMULATION_PARAMS,
  );
  const simParams = packPbfSimulationParams(BOTTLE_SIMULATION_PARAMS, BOTTLE_BOUNDARY_PROFILE);
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
      {
        binding: 3,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
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
      {
        binding: 3,
        resource: { buffer: surfaceParamsBuffer },
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

    updateSurfaceSize();

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
