import type {
  WebGpuSimulationSchema,
  BufferBindingSchema,
  BindGroupLayoutSchema,
  BindGroupSchema,
  ShaderSchema,
  ComputePipelineSchema,
  ComputePassSchema,
  RenderGraphSchema,
} from "../index.ts";
import {
  createStorageBufferSchema,
  createUniformBufferSchema,
  createBindGroupLayoutSchema,
  createBindingSchema,
  DefaultSchemaBuilder,
  SHADER_STAGE,
} from "../index.ts";

// ============================================================================
// 配置常量
// ============================================================================

const NUM_PARTICLES = 60 * 20;
const GRID_WIDTH = 32;
const GRID_HEIGHT = 16;
const MAX_PARTICLES_PER_CELL = 100;
const MAX_NEIGHBORS = 100;
const SIM_PARAMS_SIZE = 36 * 4; // 36 floats = 144 bytes

// ============================================================================
// WGSL 着色器源码
// ============================================================================

const sharedBindingsWGSL = `
struct Vec2Buffer {
  data: array<vec2<f32>>,
}

struct U32Buffer {
  data: array<u32>,
}

struct AtomicU32Buffer {
  data: array<atomic<u32>>,
}

struct I32Buffer {
  data: array<i32>,
}

@group(0) @binding(0) var<storage, read_write> positions: Vec2Buffer;
@group(0) @binding(1) var<storage, read_write> oldPositions: Vec2Buffer;
@group(0) @binding(2) var<storage, read_write> velocities: Vec2Buffer;
@group(0) @binding(3) var<storage, read_write> positionDeltas: Vec2Buffer;

@group(0) @binding(4) var<storage, read_write> gridCounts: AtomicU32Buffer;
@group(0) @binding(5) var<storage, read_write> grid2Particles: U32Buffer;
@group(0) @binding(6) var<storage, read_write> neighborCounts: U32Buffer;
@group(0) @binding(7) var<storage, read_write> neighbors: I32Buffer;

struct SimParams {
  data: array<vec4<f32>, 9>,
}

@group(0) @binding(8) var<uniform> simParams: SimParams;

fn simParam(index: u32) -> f32 {
  let chunk = simParams.data[index / 4u];
  let lane = index % 4u;
  if (lane == 0u) { return chunk.x; }
  if (lane == 1u) { return chunk.y; }
  if (lane == 2u) { return chunk.z; }
  return chunk.w;
}

fn particleCount() -> u32 { return u32(simParam(0u)); }
fn gridWidth() -> u32 { return u32(simParam(1u)); }
fn gridHeight() -> u32 { return u32(simParam(2u)); }
fn maxParticlesPerCell() -> u32 { return u32(simParam(3u)); }
fn maxNeighbors() -> u32 { return u32(simParam(4u)); }
fn timeDelta() -> f32 { return simParam(6u); }
fn h() -> f32 { return simParam(7u); }
fn rho0() -> f32 { return simParam(8u); }
fn lambdaEpsilon() -> f32 { return simParam(9u); }
fn boundaryX() -> f32 { return simParam(10u); }
fn boundaryY() -> f32 { return simParam(11u); }
fn particleRadiusInWorld() -> f32 { return simParam(12u); }
fn epsilon() -> f32 { return simParam(13u); }
fn mass() -> f32 { return simParam(14u); }
fn neighborRadius() -> f32 { return simParam(15u); }
fn corrDeltaQCoeff() -> f32 { return simParam(16u); }
fn corrK() -> f32 { return simParam(17u); }
fn poly6Factor() -> f32 { return simParam(18u); }
fn spikyGradFactor() -> f32 { return simParam(19u); }
fn cellReciprocal() -> f32 { return simParam(20u); }
fn gravityX() -> f32 { return simParam(33u); }
fn gravityY() -> f32 { return simParam(34u); }
fn velocityDamping() -> f32 { return simParam(35u); }
fn boundaryMode() -> u32 { return u32(simParam(22u)); }
fn boundaryCenterX() -> f32 { return simParam(23u); }
fn boundaryCenterY() -> f32 { return simParam(26u); }
fn boundaryHalfHeight() -> f32 { return simParam(27u); }
fn boundaryBezierNeckWidth() -> f32 { return simParam(28u); }
fn boundaryBezierTopWidth() -> f32 { return simParam(29u); }
fn boundaryBezierBottomWidth() -> f32 { return simParam(30u); }
fn inertialAccelX() -> f32 { return simParam(31u); }
fn inertialAccelY() -> f32 { return simParam(32u); }
fn viscosityEnabled() -> f32 { return simParam(24u); }
fn viscosityC() -> f32 { return simParam(25u); }

fn cubicBezierEase(t: f32) -> f32 {
  let oneMinusT = 1.0 - t;
  return 3.0 * oneMinusT * oneMinusT * t * 0.72 + 3.0 * oneMinusT * t * t * 0.98 + t * t * t;
}

fn boundaryBezierHalfWidth(y: f32, pRad: f32, bmin: f32) -> f32 {
  let halfHeight = max(boundaryHalfHeight() - pRad, epsilon());
  let yDelta = y - boundaryCenterY();
  let localY = clamp(abs(yDelta) / halfHeight, 0.0, 1.0);
  let maxHalfWidth = max(boundaryCenterX() - pRad, bmin + epsilon());
  let neckHalfWidth = clamp(boundaryBezierNeckWidth() * 0.5 - pRad, bmin + epsilon(), maxHalfWidth);
  let endHalfWidth = select(
    clamp(boundaryBezierBottomWidth() * 0.5 - pRad, bmin + epsilon(), maxHalfWidth),
    clamp(boundaryBezierTopWidth() * 0.5 - pRad, bmin + epsilon(), maxHalfWidth),
    yDelta >= 0.0,
  );
  return neckHalfWidth + (endHalfWidth - neckHalfWidth) * cubicBezierEase(localY);
}

fn inGrid(cell: vec2<i32>) -> bool {
  return cell.x >= 0 && cell.y >= 0 && cell.x < i32(gridWidth()) && cell.y < i32(gridHeight());
}

fn cellFromPos(pos: vec2<f32>) -> vec2<i32> {
  return vec2<i32>(floor(pos * cellReciprocal()));
}

fn flatCellIndex(cell: vec2<i32>) -> u32 {
  return u32(cell.y) * gridWidth() + u32(cell.x);
}

fn neighborIndex(particleIndex: u32, neighborSlot: u32) -> u32 {
  return particleIndex * maxNeighbors() + neighborSlot;
}

fn gridSlotIndex(cellIndex: u32, slot: u32) -> u32 {
  return cellIndex * maxParticlesPerCell() + slot;
}

fn gridCountAt(cellIndex: u32) -> u32 {
  return min(atomicLoad(&gridCounts.data[cellIndex]), maxParticlesPerCell());
}

fn confinePosition(pos: vec2<f32>) -> vec2<f32> {
  let pRad = particleRadiusInWorld();
  let bmin = pRad;
  let bmax = vec2<f32>(boundaryX() - pRad, boundaryY() - pRad);
  var out = pos;

  if (boundaryMode() == 1u) {
    let yHalfSpan = max(boundaryHalfHeight() - pRad, epsilon());
    let yMin = max(bmin, boundaryCenterY() - yHalfSpan);
    let yMax = min(bmax.y, boundaryCenterY() + yHalfSpan);
    out.y = clamp(out.y, yMin + epsilon(), yMax - epsilon());

    let halfWidth = boundaryBezierHalfWidth(out.y, pRad, bmin);
    let left = max(bmin, boundaryCenterX() - halfWidth);
    let right = min(bmax.x, boundaryCenterX() + halfWidth);

    if (out.x <= left) { out.x = left + epsilon(); }
    else if (out.x >= right) { out.x = right - epsilon(); }

    return out;
  }

  if (out.x <= bmin) { out.x = bmin + epsilon(); }
  else if (out.x >= bmax.x) { out.x = bmax.x - epsilon(); }

  if (out.y <= bmin) { out.y = bmin + epsilon(); }
  else if (out.y >= bmax.y) { out.y = bmax.y - epsilon(); }

  return out;
}

fn poly6Value(s: f32, hVal: f32) -> f32 {
  if (s > 0.0 && s < hVal) {
    let h2 = hVal * hVal;
    let x = (h2 - s * s) / (hVal * hVal * hVal);
    return poly6Factor() * x * x * x;
  }
  return 0.0;
}

fn spikyGradient(r: vec2<f32>, hVal: f32) -> vec2<f32> {
  let rLen = length(r);
  if (rLen > 0.0 && rLen < hVal) {
    let x = (hVal - rLen) / (hVal * hVal * hVal);
    let gFactor = spikyGradFactor() * x * x;
    return r * (gFactor / rLen);
  }
  return vec2<f32>(0.0, 0.0);
}

fn computeScorr(posJi: vec2<f32>) -> f32 {
  let hVal = h();
  let denom = poly6Value(corrDeltaQCoeff() * hVal, hVal);
  if (denom <= 1e-7) { return 0.0; }
  var x = poly6Value(length(posJi), hVal) / denom;
  x = x * x;
  x = x * x;
  return -corrK() * x;
}
`;

const pbfSolverBindingsWGSL = `
struct F32Buffer {
  data: array<f32>,
}

@group(1) @binding(0) var<storage, read_write> lambdas: F32Buffer;
`;

// ============================================================================
// 着色器定义
// ============================================================================

const shaderPrologue: ShaderSchema = {
  name: "shader-prologue",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }

  oldPositions.data[i] = positions.data[i];

  var vel = velocities.data[i];
  vel += vec2<f32>(gravityX() + inertialAccelX(), gravityY() + inertialAccelY()) * timeDelta();
  var pos = positions.data[i] + vel * timeDelta();
  pos = confinePosition(pos);

  velocities.data[i] = vel;
  positions.data[i] = pos;
}
`,
};

const shaderClearGrid: ShaderSchema = {
  name: "shader-clear-grid",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let numCells = gridWidth() * gridHeight();
  if (i >= numCells) { return; }

  atomicStore(&gridCounts.data[i], 0u);
}
`,
};

const shaderBuildGrid: ShaderSchema = {
  name: "shader-build-grid",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }

  let cell = cellFromPos(positions.data[i]);
  if (!inGrid(cell)) { return; }

  let cellIndex = flatCellIndex(cell);
  let slot = atomicAdd(&gridCounts.data[cellIndex], 1u);
  if (slot < maxParticlesPerCell()) {
    grid2Particles.data[gridSlotIndex(cellIndex, slot)] = i;
  }
}
`,
};

const shaderPbfLambda: ShaderSchema = {
  name: "shader-pbf-lambda",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared", "layout-pbf"],
  source: `
${sharedBindingsWGSL}
${pbfSolverBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }

  let posI = positions.data[i];
  let maxNb = maxNeighbors();
  let centerCell = cellFromPos(posI);

  var nbCount = 0u;
  for (var oy = -1; oy <= 1; oy += 1) {
    for (var ox = -1; ox <= 1; ox += 1) {
      if (nbCount >= maxNb) { break; }

      let cell = centerCell + vec2<i32>(ox, oy);
      if (!inGrid(cell)) { continue; }

      let cellIndex = flatCellIndex(cell);
      let cellCount = gridCountAt(cellIndex);
      for (var slot = 0u; slot < cellCount; slot += 1u) {
        if (nbCount >= maxNb) { break; }

        let pj = grid2Particles.data[gridSlotIndex(cellIndex, slot)];
        if (pj == i) { continue; }

        if (length(posI - positions.data[pj]) < neighborRadius()) {
          neighbors.data[neighborIndex(i, nbCount)] = i32(pj);
          nbCount += 1u;
        }
      }
    }
  }

  neighborCounts.data[i] = nbCount;
  for (var n = nbCount; n < maxNb; n += 1u) {
    neighbors.data[neighborIndex(i, n)] = -1;
  }

  var gradI = vec2<f32>(0.0, 0.0);
  var sumGradientSqr = 0.0;
  var densityConstraint = 0.0;

  for (var n = 0u; n < nbCount; n += 1u) {
    let pj = u32(neighbors.data[neighborIndex(i, n)]);
    let posJi = posI - positions.data[pj];
    let gradJ = spikyGradient(posJi, h());
    gradI += gradJ;
    sumGradientSqr += dot(gradJ, gradJ);
    densityConstraint += poly6Value(length(posJi), h());
  }

  densityConstraint = (mass() * densityConstraint / rho0()) - 1.0;
  sumGradientSqr += dot(gradI, gradI);
  lambdas.data[i] = (-densityConstraint) / (sumGradientSqr + lambdaEpsilon());
}
`,
};

const shaderPbfDelta: ShaderSchema = {
  name: "shader-pbf-delta",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared", "layout-pbf"],
  source: `
${sharedBindingsWGSL}
${pbfSolverBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }

  let posI = positions.data[i];
  let lambdaI = lambdas.data[i];
  let nbCount = neighborCounts.data[i];
  var posDelta = vec2<f32>(0.0, 0.0);

  for (var n = 0u; n < nbCount; n += 1u) {
    let pjRaw = neighbors.data[neighborIndex(i, n)];
    if (pjRaw < 0) { break; }
    let pj = u32(pjRaw);
    let posJi = posI - positions.data[pj];
    let lambdaJ = lambdas.data[pj];
    let scorr = computeScorr(posJi);
    posDelta += (lambdaI + lambdaJ + scorr) * spikyGradient(posJi, h());
  }

  positionDeltas.data[i] = posDelta / rho0();
}
`,
};

const shaderApplyDelta: ShaderSchema = {
  name: "shader-apply-delta",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }
  positions.data[i] = positions.data[i] + positionDeltas.data[i];
}
`,
};

const shaderEpilogue: ShaderSchema = {
  name: "shader-epilogue",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }

  let pos = confinePosition(positions.data[i]);
  let baseVel = (pos - oldPositions.data[i]) / timeDelta();
  var outVel = baseVel;

  if (viscosityEnabled() > 0.5 && viscosityC() > 0.0) {
    let nbCount = neighborCounts.data[i];
    var localWeight = 0.0;

    for (var n = 0u; n < nbCount; n += 1u) {
      let pjRaw = neighbors.data[neighborIndex(i, n)];
      if (pjRaw < 0) { break; }
      let pj = u32(pjRaw);
      let posJi = pos - positions.data[pj];
      localWeight += poly6Value(length(posJi), h());
    }

    let damp = 1.0 / (1.0 + viscosityC() * localWeight * timeDelta());
    outVel = baseVel * damp;
  }

  outVel = outVel * clamp(velocityDamping(), 0.0, 1.0);

  positions.data[i] = pos;
  velocities.data[i] = outVel;
}
`,
};

// ============================================================================
// 缓冲区定义
// ============================================================================

const bufferPositions: BufferBindingSchema = createStorageBufferSchema(
  "positions",
  NUM_PARTICLES * 8,
  { mappable: true },
);

const bufferOldPositions: BufferBindingSchema = createStorageBufferSchema(
  "oldPositions",
  NUM_PARTICLES * 8,
);

const bufferVelocities: BufferBindingSchema = createStorageBufferSchema(
  "velocities",
  NUM_PARTICLES * 8,
);

const bufferPositionDeltas: BufferBindingSchema = createStorageBufferSchema(
  "positionDeltas",
  NUM_PARTICLES * 8,
);

const bufferGridCounts: BufferBindingSchema = createStorageBufferSchema(
  "gridCounts",
  GRID_WIDTH * GRID_HEIGHT * 4,
);

const bufferGrid2Particles: BufferBindingSchema = createStorageBufferSchema(
  "grid2Particles",
  GRID_WIDTH * GRID_HEIGHT * MAX_PARTICLES_PER_CELL * 4,
);

const bufferNeighborCounts: BufferBindingSchema = createStorageBufferSchema(
  "neighborCounts",
  NUM_PARTICLES * 4,
);

const bufferNeighbors: BufferBindingSchema = createStorageBufferSchema(
  "neighbors",
  NUM_PARTICLES * MAX_NEIGHBORS * 4,
);

const bufferLambdas: BufferBindingSchema = createStorageBufferSchema("lambdas", NUM_PARTICLES * 4);

const bufferSimParams: BufferBindingSchema = createUniformBufferSchema(
  "simParams",
  SIM_PARAMS_SIZE,
);

// ============================================================================
// BindGroupLayout 定义
// ============================================================================

const layoutShared: BindGroupLayoutSchema = createBindGroupLayoutSchema("layout-shared", [
  createBindingSchema(0, "positions", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(1, "oldPositions", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(2, "velocities", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(3, "positionDeltas", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(4, "gridCounts", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(5, "grid2Particles", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(6, "neighborCounts", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(7, "neighbors", "buffer", SHADER_STAGE.COMPUTE),
  createBindingSchema(8, "simParams", "buffer", SHADER_STAGE.COMPUTE),
]);

const layoutPbf: BindGroupLayoutSchema = createBindGroupLayoutSchema("layout-pbf", [
  createBindingSchema(0, "lambdas", "buffer", SHADER_STAGE.COMPUTE),
]);

// ============================================================================
// BindGroup 定义
// ============================================================================

const bgShared: BindGroupSchema = {
  name: "bg-shared",
  layout: "layout-shared",
  bindings: [
    { binding: 0, resourceRef: "positions" },
    { binding: 1, resourceRef: "oldPositions" },
    { binding: 2, resourceRef: "velocities" },
    { binding: 3, resourceRef: "positionDeltas" },
    { binding: 4, resourceRef: "gridCounts" },
    { binding: 5, resourceRef: "grid2Particles" },
    { binding: 6, resourceRef: "neighborCounts" },
    { binding: 7, resourceRef: "neighbors" },
    { binding: 8, resourceRef: "simParams" },
  ],
};

const bgPbf: BindGroupSchema = {
  name: "bg-pbf",
  layout: "layout-pbf",
  bindings: [{ binding: 0, resourceRef: "lambdas" }],
};

// ============================================================================
// 管线定义
// ============================================================================

const pipelinePrologue: ComputePipelineSchema = {
  name: "pipeline-prologue",
  type: "compute",
  shader: "shader-prologue",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [128, 1, 1],
};

const pipelineClearGrid: ComputePipelineSchema = {
  name: "pipeline-clear-grid",
  type: "compute",
  shader: "shader-clear-grid",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [128, 1, 1],
};

const pipelineBuildGrid: ComputePipelineSchema = {
  name: "pipeline-build-grid",
  type: "compute",
  shader: "shader-build-grid",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [128, 1, 1],
};

const pipelinePbfLambda: ComputePipelineSchema = {
  name: "pipeline-pbf-lambda",
  type: "compute",
  shader: "shader-pbf-lambda",
  bindGroups: [
    { group: 0, layout: "layout-shared" },
    { group: 1, layout: "layout-pbf" },
  ],
  workgroupSize: [128, 1, 1],
};

const pipelinePbfDelta: ComputePipelineSchema = {
  name: "pipeline-pbf-delta",
  type: "compute",
  shader: "shader-pbf-delta",
  bindGroups: [
    { group: 0, layout: "layout-shared" },
    { group: 1, layout: "layout-pbf" },
  ],
  workgroupSize: [128, 1, 1],
};

const pipelineApplyDelta: ComputePipelineSchema = {
  name: "pipeline-apply-delta",
  type: "compute",
  shader: "shader-apply-delta",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [128, 1, 1],
};

const pipelineEpilogue: ComputePipelineSchema = {
  name: "pipeline-epilogue",
  type: "compute",
  shader: "shader-epilogue",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [128, 1, 1],
};

// ============================================================================
// Pass 定义
// ============================================================================

const passPrologue: ComputePassSchema = {
  name: "pass-prologue",
  type: "compute",
  pipelineRef: "pipeline-prologue",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / 128)` },
};

const passClearGrid: ComputePassSchema = {
  name: "pass-clear-grid",
  type: "compute",
  pipelineRef: "pipeline-clear-grid",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${GRID_WIDTH * GRID_HEIGHT} / 128)` },
};

const passBuildGrid: ComputePassSchema = {
  name: "pass-build-grid",
  type: "compute",
  pipelineRef: "pipeline-build-grid",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / 128)` },
};

const passPbfLambda: ComputePassSchema = {
  name: "pass-pbf-lambda",
  type: "compute",
  pipelineRef: "pipeline-pbf-lambda",
  bindGroups: [
    { group: 0, bindGroupRef: "bg-shared" },
    { group: 1, bindGroupRef: "bg-pbf" },
  ],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / 128)` },
};

const passPbfDelta: ComputePassSchema = {
  name: "pass-pbf-delta",
  type: "compute",
  pipelineRef: "pipeline-pbf-delta",
  bindGroups: [
    { group: 0, bindGroupRef: "bg-shared" },
    { group: 1, bindGroupRef: "bg-pbf" },
  ],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / 128)` },
};

const passApplyDelta: ComputePassSchema = {
  name: "pass-apply-delta",
  type: "compute",
  pipelineRef: "pipeline-apply-delta",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / 128)` },
};

const passEpilogue: ComputePassSchema = {
  name: "pass-epilogue",
  type: "compute",
  pipelineRef: "pipeline-epilogue",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / 128)` },
};

// ============================================================================
// RenderGraph 定义
// ============================================================================

const mainRenderGraph: RenderGraphSchema = {
  name: "main-simulation-graph",
  nodes: [
    { name: "node-clear-grid", passRef: "pass-clear-grid" },
    { name: "node-prologue", passRef: "pass-prologue", dependencies: ["node-clear-grid"] },
    { name: "node-build-grid", passRef: "pass-build-grid", dependencies: ["node-prologue"] },
    { name: "node-pbf-lambda", passRef: "pass-pbf-lambda", dependencies: ["node-build-grid"] },
    { name: "node-pbf-delta", passRef: "pass-pbf-delta", dependencies: ["node-pbf-lambda"] },
    { name: "node-apply-delta", passRef: "pass-apply-delta", dependencies: ["node-pbf-delta"] },
    { name: "node-epilogue", passRef: "pass-epilogue", dependencies: ["node-apply-delta"] },
  ],
};

// ============================================================================
// 完整 Schema 组装
// ============================================================================

export const pbfSimulationSchema: WebGpuSimulationSchema = {
  name: "PBF-WebGPU-Simulation",
  version: "1.0.0",

  buffers: {
    positions: bufferPositions,
    oldPositions: bufferOldPositions,
    velocities: bufferVelocities,
    positionDeltas: bufferPositionDeltas,
    gridCounts: bufferGridCounts,
    grid2Particles: bufferGrid2Particles,
    neighborCounts: bufferNeighborCounts,
    neighbors: bufferNeighbors,
    lambdas: bufferLambdas,
    simParams: bufferSimParams,
  },

  bindGroupLayouts: {
    "layout-shared": layoutShared,
    "layout-pbf": layoutPbf,
  },

  bindGroups: {
    "bg-shared": bgShared,
    "bg-pbf": bgPbf,
  },

  shaders: {
    "shader-prologue": shaderPrologue,
    "shader-clear-grid": shaderClearGrid,
    "shader-build-grid": shaderBuildGrid,
    "shader-pbf-lambda": shaderPbfLambda,
    "shader-pbf-delta": shaderPbfDelta,
    "shader-apply-delta": shaderApplyDelta,
    "shader-epilogue": shaderEpilogue,
  },

  pipelines: {
    "pipeline-prologue": pipelinePrologue,
    "pipeline-clear-grid": pipelineClearGrid,
    "pipeline-build-grid": pipelineBuildGrid,
    "pipeline-pbf-lambda": pipelinePbfLambda,
    "pipeline-pbf-delta": pipelinePbfDelta,
    "pipeline-apply-delta": pipelineApplyDelta,
    "pipeline-epilogue": pipelineEpilogue,
  },

  passes: {
    "pass-prologue": passPrologue,
    "pass-clear-grid": passClearGrid,
    "pass-build-grid": passBuildGrid,
    "pass-pbf-lambda": passPbfLambda,
    "pass-pbf-delta": passPbfDelta,
    "pass-apply-delta": passApplyDelta,
    "pass-epilogue": passEpilogue,
  },

  renderGraphs: {
    "main-simulation-graph": mainRenderGraph,
  },

  mainGraphRef: "main-simulation-graph",
};

export function createPbfSimulationSchema(): WebGpuSimulationSchema {
  const builder = new DefaultSchemaBuilder();

  builder
    .addBuffer(bufferPositions)
    .addBuffer(bufferOldPositions)
    .addBuffer(bufferVelocities)
    .addBuffer(bufferPositionDeltas)
    .addBuffer(bufferGridCounts)
    .addBuffer(bufferGrid2Particles)
    .addBuffer(bufferNeighborCounts)
    .addBuffer(bufferNeighbors)
    .addBuffer(bufferLambdas)
    .addBuffer(bufferSimParams)
    .addBindGroupLayout(layoutShared)
    .addBindGroupLayout(layoutPbf)
    .addBindGroup(bgShared)
    .addBindGroup(bgPbf)
    .addShader(shaderPrologue)
    .addShader(shaderClearGrid)
    .addShader(shaderBuildGrid)
    .addShader(shaderPbfLambda)
    .addShader(shaderPbfDelta)
    .addShader(shaderApplyDelta)
    .addShader(shaderEpilogue)
    .addPipeline(pipelinePrologue)
    .addPipeline(pipelineClearGrid)
    .addPipeline(pipelineBuildGrid)
    .addPipeline(pipelinePbfLambda)
    .addPipeline(pipelinePbfDelta)
    .addPipeline(pipelineApplyDelta)
    .addPipeline(pipelineEpilogue)
    .addPass(passPrologue)
    .addPass(passClearGrid)
    .addPass(passBuildGrid)
    .addPass(passPbfLambda)
    .addPass(passPbfDelta)
    .addPass(passApplyDelta)
    .addPass(passEpilogue)
    .addRenderGraph(mainRenderGraph);

  return builder.build("PBF-WebGPU-Simulation", "1.0.0");
}
