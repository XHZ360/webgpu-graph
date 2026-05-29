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
const WORKGROUP_SIZE = 128;
const SIM_PARAMS_BASE_FLOAT_COUNT = 36;
const BOUNDARY_PROFILE_SAMPLE_COUNT = 128;
const BOUNDARY_PROFILE_META_FLOAT_COUNT = 4;
const BOUNDARY_PROFILE_FLOAT_COUNT = BOUNDARY_PROFILE_SAMPLE_COUNT * 2;
const BOUNDARY_PROFILE_START_FLOAT_INDEX = SIM_PARAMS_BASE_FLOAT_COUNT;
const SIM_PARAMS_FLOAT_COUNT =
  SIM_PARAMS_BASE_FLOAT_COUNT + BOUNDARY_PROFILE_META_FLOAT_COUNT + BOUNDARY_PROFILE_FLOAT_COUNT;
const SIM_PARAMS_SIZE = SIM_PARAMS_FLOAT_COUNT * 4;
const SIM_PARAMS_VEC4_COUNT = Math.ceil(SIM_PARAMS_FLOAT_COUNT / 4);

const INITIAL_PARTICLE_COLUMNS = 60;
const INITIAL_PARTICLE_ROWS = 20;

export const PBF_NUM_PARTICLES = NUM_PARTICLES;
export const PBF_GRID_WIDTH = GRID_WIDTH;
export const PBF_GRID_HEIGHT = GRID_HEIGHT;
export const PBF_MAX_PARTICLES_PER_CELL = MAX_PARTICLES_PER_CELL;
export const PBF_MAX_NEIGHBORS = MAX_NEIGHBORS;
export const PBF_WORKGROUP_SIZE = WORKGROUP_SIZE;
export const PBF_BOUNDARY_PROFILE_SAMPLE_COUNT = BOUNDARY_PROFILE_SAMPLE_COUNT;
export const PBF_BOUNDARY_PROFILE_FLOAT_COUNT = BOUNDARY_PROFILE_FLOAT_COUNT;
export const PBF_SIM_PARAMS_FLOAT_COUNT = SIM_PARAMS_FLOAT_COUNT;
export const PBF_SIM_PARAMS_SIZE = SIM_PARAMS_SIZE;
export const PBF_SIM_PARAMS_VEC4_COUNT = SIM_PARAMS_VEC4_COUNT;

export const PBF_SIMULATION_METADATA = Object.freeze({
  particleCount: PBF_NUM_PARTICLES,
  gridWidth: PBF_GRID_WIDTH,
  gridHeight: PBF_GRID_HEIGHT,
  maxParticlesPerCell: PBF_MAX_PARTICLES_PER_CELL,
  maxNeighbors: PBF_MAX_NEIGHBORS,
  pbfIterations: 5,
  workgroupSize: PBF_WORKGROUP_SIZE,
  boundaryProfileSampleCount: PBF_BOUNDARY_PROFILE_SAMPLE_COUNT,
  boundaryProfileFloatCount: PBF_BOUNDARY_PROFILE_FLOAT_COUNT,
  simParamsVec4Count: PBF_SIM_PARAMS_VEC4_COUNT,
  simParamsFloatCount: PBF_SIM_PARAMS_FLOAT_COUNT,
  simParamsSize: PBF_SIM_PARAMS_SIZE,
});

export interface PbfSimulationParams {
  particleCount: number;
  gridWidth: number;
  gridHeight: number;
  maxParticlesPerCell: number;
  maxNeighbors: number;
  pbfIterations: number;
  timeDelta: number;
  h: number;
  rho0: number;
  lambdaEpsilon: number;
  boundaryX: number;
  boundaryY: number;
  particleRadiusInWorld: number;
  epsilon: number;
  mass: number;
  neighborRadius: number;
  corrDeltaQCoeff: number;
  corrK: number;
  poly6Factor: number;
  spikyGradFactor: number;
  cellReciprocal: number;
  boundaryMode: number;
  boundaryCenterX: number;
  viscosityEnabled: number;
  viscosityC: number;
  boundaryCenterY: number;
  boundaryHalfHeight: number;
  boundaryBezierNeckWidth: number;
  boundaryBezierTopWidth: number;
  boundaryBezierBottomWidth: number;
  inertialAccelX: number;
  inertialAccelY: number;
  gravityX: number;
  gravityY: number;
  velocityDamping: number;
}

export interface PbfBoundaryProfile {
  cellCount: number;
  minY: number;
  maxY: number;
  innerMargin?: number;
  left: ArrayLike<number>;
  right: ArrayLike<number>;
}

export interface PbfInitialParticleState {
  positions: Float32Array;
  oldPositions: Float32Array;
  velocities: Float32Array;
}

function computePoly6Factor(h: number): number {
  return 315 / (64 * Math.PI * Math.pow(h, 9));
}

function computeSpikyGradFactor(h: number): number {
  return -45 / (Math.PI * Math.pow(h, 6));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

// These defaults are chosen conservatively for a deterministic demo reset path.
// They are internally consistent with the WGSL layout and grid dimensions even
// though the original runtime constants are not available in this package.
export const PBF_DEFAULT_SIMULATION_PARAMS: Readonly<PbfSimulationParams> = Object.freeze({
  particleCount: PBF_NUM_PARTICLES,
  gridWidth: PBF_GRID_WIDTH,
  gridHeight: PBF_GRID_HEIGHT,
  maxParticlesPerCell: PBF_MAX_PARTICLES_PER_CELL,
  maxNeighbors: PBF_MAX_NEIGHBORS,
  pbfIterations: PBF_SIMULATION_METADATA.pbfIterations,
  timeDelta: 1 / 20,
  h: 1.1,
  rho0: 1,
  lambdaEpsilon: 100,
  boundaryX: 80,
  boundaryY: 40,
  particleRadiusInWorld: 0.3,
  epsilon: 1e-5,
  mass: 1,
  neighborRadius: 1.1 * 1.05,
  corrDeltaQCoeff: 0.3,
  corrK: 0.001,
  poly6Factor: computePoly6Factor(1.1),
  spikyGradFactor: computeSpikyGradFactor(1.1),
  cellReciprocal: 1 / 2.51,
  boundaryMode: 1,
  boundaryCenterX: 40,
  viscosityEnabled: 0,
  viscosityC: 0,
  boundaryCenterY: 20,
  boundaryHalfHeight: 18,
  boundaryBezierNeckWidth: 20,
  boundaryBezierTopWidth: 80,
  boundaryBezierBottomWidth: 80,
  inertialAccelX: 0,
  inertialAccelY: 0,
  gravityX: 0,
  gravityY: -9.8,
  velocityDamping: 0.985,
});

function resolvePbfSimulationParams(
  overrides: Partial<PbfSimulationParams> = {},
): PbfSimulationParams {
  const params = {
    ...PBF_DEFAULT_SIMULATION_PARAMS,
    ...overrides,
  };

  return {
    ...params,
    poly6Factor: overrides.poly6Factor ?? computePoly6Factor(params.h),
    spikyGradFactor: overrides.spikyGradFactor ?? computeSpikyGradFactor(params.h),
    cellReciprocal:
      overrides.cellReciprocal ??
      (overrides.boundaryX !== undefined
        ? params.gridWidth / params.boundaryX
        : params.cellReciprocal),
    boundaryCenterX: overrides.boundaryCenterX ?? params.boundaryX * 0.5,
    boundaryCenterY: overrides.boundaryCenterY ?? params.boundaryY * 0.5,
    boundaryHalfHeight:
      overrides.boundaryHalfHeight ??
      (overrides.boundaryY !== undefined ? params.boundaryY * 0.425 : params.boundaryHalfHeight),
    boundaryBezierNeckWidth:
      overrides.boundaryBezierNeckWidth ??
      (overrides.boundaryX !== undefined
        ? params.boundaryX * 0.45
        : params.boundaryBezierNeckWidth),
    boundaryBezierTopWidth:
      overrides.boundaryBezierTopWidth ??
      (overrides.boundaryX !== undefined ? params.boundaryX * 0.8 : params.boundaryBezierTopWidth),
    boundaryBezierBottomWidth:
      overrides.boundaryBezierBottomWidth ??
      (overrides.boundaryX !== undefined
        ? params.boundaryX * 0.8
        : params.boundaryBezierBottomWidth),
  };
}

export function createPbfInitialPositions(
  overrides: Partial<PbfSimulationParams> = {},
): Float32Array {
  const params = resolvePbfSimulationParams(overrides);
  const positions = new Float32Array(PBF_NUM_PARTICLES * 2);

  const delta = params.h * 0.8;
  const offsetX = (params.boundaryX - delta * INITIAL_PARTICLE_COLUMNS) * 0.5;
  const offsetY = params.boundaryY;

  for (let row = 0; row < INITIAL_PARTICLE_ROWS; row += 1) {
    for (let col = 0; col < INITIAL_PARTICLE_COLUMNS; col += 1) {
      const index = row * INITIAL_PARTICLE_COLUMNS + col;
      const offset = index * 2;
      positions[offset] = col * delta + offsetX;
      positions[offset + 1] = offsetY - row * delta;
    }
  }

  return positions;
}

export function createPbfInitialPositionsFromBoundaryProfile(
  profile: PbfBoundaryProfile,
  overrides: Partial<PbfSimulationParams> = {},
): Float32Array {
  const params = resolvePbfSimulationParams(overrides);
  const positions = createPbfInitialPositions(overrides);
  const cellCount = clampInt(profile.cellCount, 1, PBF_BOUNDARY_PROFILE_SAMPLE_COUNT);
  const minY = profile.minY;
  const maxY = profile.maxY;
  const innerMargin =
    (profile.innerMargin ?? params.particleRadiusInWorld) + params.particleRadiusInWorld;
  const verticalSpan = maxY - minY;
  const rowStride = cellCount > 1 ? verticalSpan / (cellCount - 1) : 0;
  const step = params.particleRadiusInWorld * 2.05;

  let particleIndex = 0;
  for (let row = 0; row < cellCount && particleIndex < PBF_NUM_PARTICLES; row += 1) {
    const y = minY + row * rowStride;
    const rawLeft = profile.left[row] ?? profile.left[cellCount - 1] ?? 0;
    const rawRight = profile.right[row] ?? profile.right[cellCount - 1] ?? rawLeft;
    const left = Math.min(rawLeft, rawRight);
    const right = Math.max(rawLeft, rawRight);
    const startX = left + innerMargin;
    const endX = right - innerMargin;

    if (endX <= startX) {
      continue;
    }

    for (let x = startX; x <= endX && particleIndex < PBF_NUM_PARTICLES; x += step) {
      const offset = particleIndex * 2;
      positions[offset] = x;
      positions[offset + 1] = y;
      particleIndex += 1;
    }
  }

  return positions;
}

export function createPbfInitialVelocities(): Float32Array {
  const velocities = new Float32Array(PBF_NUM_PARTICLES * 2);
  let seed = 0x12345678;

  for (let index = 0; index < velocities.length; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    velocities[index] = (seed / 0x100000000 - 0.5) * 4;
  }

  return velocities;
}

export function createPbfInitialParticleState(
  overrides: Partial<PbfSimulationParams> = {},
): PbfInitialParticleState {
  const positions = createPbfInitialPositions(overrides);

  return {
    positions,
    oldPositions: new Float32Array(positions),
    velocities: createPbfInitialVelocities(),
  };
}

export function createPbfInitialParticleStateFromBoundaryProfile(
  profile: PbfBoundaryProfile,
  overrides: Partial<PbfSimulationParams> = {},
): PbfInitialParticleState {
  const positions = createPbfInitialPositionsFromBoundaryProfile(profile, overrides);

  return {
    positions,
    oldPositions: new Float32Array(positions),
    velocities: createPbfInitialVelocities(),
  };
}

export function packPbfBoundaryProfile(profile: PbfBoundaryProfile): Float32Array {
  const packed = new Float32Array(BOUNDARY_PROFILE_META_FLOAT_COUNT + BOUNDARY_PROFILE_FLOAT_COUNT);
  const cellCount = clampInt(profile.cellCount, 1, PBF_BOUNDARY_PROFILE_SAMPLE_COUNT);
  packed[0] = cellCount;
  packed[1] = profile.minY;
  packed[2] = profile.maxY;
  packed[3] = profile.innerMargin ?? 0;

  for (let i = 0; i < PBF_BOUNDARY_PROFILE_SAMPLE_COUNT; i += 1) {
    const left = profile.left[i] ?? profile.left[cellCount - 1] ?? 0;
    const right = profile.right[i] ?? profile.right[cellCount - 1] ?? left;
    const offset = BOUNDARY_PROFILE_META_FLOAT_COUNT + i * 2;
    packed[offset] = left;
    packed[offset + 1] = right;
  }

  return packed;
}

export function packPbfSimulationParams(
  overrides: Partial<PbfSimulationParams> = {},
  boundaryProfile?: PbfBoundaryProfile,
): Float32Array {
  const params = resolvePbfSimulationParams(overrides);
  const packed = new Float32Array(PBF_SIM_PARAMS_FLOAT_COUNT);

  packed[0] = params.particleCount;
  packed[1] = params.gridWidth;
  packed[2] = params.gridHeight;
  packed[3] = params.maxParticlesPerCell;
  packed[4] = params.maxNeighbors;
  packed[5] = params.pbfIterations;
  packed[6] = params.timeDelta;
  packed[7] = params.h;
  packed[8] = params.rho0;
  packed[9] = params.lambdaEpsilon;
  packed[10] = params.boundaryX;
  packed[11] = params.boundaryY;
  packed[12] = params.particleRadiusInWorld;
  packed[13] = params.epsilon;
  packed[14] = params.mass;
  packed[15] = params.neighborRadius;
  packed[16] = params.corrDeltaQCoeff;
  packed[17] = params.corrK;
  packed[18] = params.poly6Factor;
  packed[19] = params.spikyGradFactor;
  packed[20] = params.cellReciprocal;
  packed[21] = 0;
  packed[22] = params.boundaryMode;
  packed[23] = params.boundaryCenterX;
  packed[24] = params.viscosityEnabled;
  packed[25] = params.viscosityC;
  packed[26] = params.boundaryCenterY;
  packed[27] = params.boundaryHalfHeight;
  packed[28] = params.boundaryBezierNeckWidth;
  packed[29] = params.boundaryBezierTopWidth;
  packed[30] = params.boundaryBezierBottomWidth;
  packed[31] = params.inertialAccelX;
  packed[32] = params.inertialAccelY;
  packed[33] = params.gravityX;
  packed[34] = params.gravityY;
  packed[35] = params.velocityDamping;
  const profile = boundaryProfile
    ? packPbfBoundaryProfile(boundaryProfile)
    : new Float32Array(BOUNDARY_PROFILE_META_FLOAT_COUNT + BOUNDARY_PROFILE_FLOAT_COUNT);
  packed.set(profile, BOUNDARY_PROFILE_START_FLOAT_INDEX);

  return packed;
}

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
  data: array<vec4<f32>, ${SIM_PARAMS_VEC4_COUNT}>,
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
fn boundaryMode() -> u32 { return u32(simParam(22u)); }
fn boundaryCenterX() -> f32 { return simParam(23u); }
fn boundaryCenterY() -> f32 { return simParam(26u); }
fn boundaryHalfHeight() -> f32 { return simParam(27u); }
fn boundaryBezierNeckWidth() -> f32 { return simParam(28u); }
fn boundaryBezierTopWidth() -> f32 { return simParam(29u); }
fn boundaryBezierBottomWidth() -> f32 { return simParam(30u); }
fn boundaryProfileCellCount() -> u32 { return u32(simParam(${BOUNDARY_PROFILE_START_FLOAT_INDEX}u)); }
fn boundaryProfileMinY() -> f32 { return simParam(${BOUNDARY_PROFILE_START_FLOAT_INDEX + 1}u); }
fn boundaryProfileMaxY() -> f32 { return simParam(${BOUNDARY_PROFILE_START_FLOAT_INDEX + 2}u); }
fn boundaryProfileInnerMargin() -> f32 { return simParam(${BOUNDARY_PROFILE_START_FLOAT_INDEX + 3}u); }
fn inertialAccelX() -> f32 { return simParam(31u); }
fn inertialAccelY() -> f32 { return simParam(32u); }
fn gravityX() -> f32 { return simParam(33u); }
fn gravityY() -> f32 { return simParam(34u); }
fn velocityDamping() -> f32 { return simParam(35u); }
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

fn boundaryProfileTAt(y: f32) -> f32 {
  let cellCount = max(boundaryProfileCellCount(), 1u);
  let minY = boundaryProfileMinY();
  let maxY = boundaryProfileMaxY();
  let t = clamp((y - minY) / max(maxY - minY, epsilon()), 0.0, 1.0);
  return t * f32(cellCount - 1u);
}

fn boundaryProfileLeftRightAt(index: u32) -> vec2<f32> {
  let base = ${BOUNDARY_PROFILE_START_FLOAT_INDEX + BOUNDARY_PROFILE_META_FLOAT_COUNT}u + index * 2u;
  return vec2<f32>(simParam(base), simParam(base + 1u));
}

fn boundaryProfileLeftRightAtY(y: f32) -> vec2<f32> {
  let profileT = boundaryProfileTAt(y);
  let lo = u32(floor(profileT));
  let hi = min(lo + 1u, max(boundaryProfileCellCount(), 1u) - 1u);
  return mix(boundaryProfileLeftRightAt(lo), boundaryProfileLeftRightAt(hi), fract(profileT));
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

  if (boundaryMode() == 2u) {
    let top = boundaryProfileMaxY() - pRad;
    let bottom = boundaryProfileMinY() + pRad;
    out.y = clamp(out.y, bottom + epsilon(), top - epsilon());
    let lr = boundaryProfileLeftRightAtY(out.y);
    out.x = clamp(out.x, lr.x + boundaryProfileInnerMargin() + pRad, lr.y - boundaryProfileInnerMargin() - pRad);
    return out;
  }

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

@group(0) @binding(9) var<storage, read_write> lambdas: F32Buffer;
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

  @compute @workgroup_size(${WORKGROUP_SIZE})
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

  @compute @workgroup_size(${WORKGROUP_SIZE})
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

  @compute @workgroup_size(${WORKGROUP_SIZE})
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
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}
${pbfSolverBindingsWGSL}

  @compute @workgroup_size(${WORKGROUP_SIZE})
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
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}
${pbfSolverBindingsWGSL}

  @compute @workgroup_size(${WORKGROUP_SIZE})
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

  @compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= particleCount()) { return; }
  positions.data[i] = confinePosition(positions.data[i] + positionDeltas.data[i]);
}
`,
};

const shaderEpilogue: ShaderSchema = {
  name: "shader-epilogue",
  entryPoint: "main",
  bindGroupLayoutRefs: ["layout-shared"],
  source: `
${sharedBindingsWGSL}

  @compute @workgroup_size(${WORKGROUP_SIZE})
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
  createBindingSchema(9, "lambdas", "buffer", SHADER_STAGE.COMPUTE),
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
    { binding: 9, resourceRef: "lambdas" },
  ],
};

// ============================================================================
// 管线定义
// ============================================================================

const pipelinePrologue: ComputePipelineSchema = {
  name: "pipeline-prologue",
  type: "compute",
  shader: "shader-prologue",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

const pipelineClearGrid: ComputePipelineSchema = {
  name: "pipeline-clear-grid",
  type: "compute",
  shader: "shader-clear-grid",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

const pipelineBuildGrid: ComputePipelineSchema = {
  name: "pipeline-build-grid",
  type: "compute",
  shader: "shader-build-grid",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

const pipelinePbfLambda: ComputePipelineSchema = {
  name: "pipeline-pbf-lambda",
  type: "compute",
  shader: "shader-pbf-lambda",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

const pipelinePbfDelta: ComputePipelineSchema = {
  name: "pipeline-pbf-delta",
  type: "compute",
  shader: "shader-pbf-delta",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

const pipelineApplyDelta: ComputePipelineSchema = {
  name: "pipeline-apply-delta",
  type: "compute",
  shader: "shader-apply-delta",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

const pipelineEpilogue: ComputePipelineSchema = {
  name: "pipeline-epilogue",
  type: "compute",
  shader: "shader-epilogue",
  bindGroups: [{ group: 0, layout: "layout-shared" }],
  workgroupSize: [WORKGROUP_SIZE, 1, 1],
};

// ============================================================================
// Pass 定义
// ============================================================================

const passPrologue: ComputePassSchema = {
  name: "pass-prologue",
  type: "compute",
  pipelineRef: "pipeline-prologue",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / ${WORKGROUP_SIZE})` },
};

const passClearGrid: ComputePassSchema = {
  name: "pass-clear-grid",
  type: "compute",
  pipelineRef: "pipeline-clear-grid",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${GRID_WIDTH * GRID_HEIGHT} / ${WORKGROUP_SIZE})` },
};

const passBuildGrid: ComputePassSchema = {
  name: "pass-build-grid",
  type: "compute",
  pipelineRef: "pipeline-build-grid",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / ${WORKGROUP_SIZE})` },
};

const passPbfLambda: ComputePassSchema = {
  name: "pass-pbf-lambda",
  type: "compute",
  pipelineRef: "pipeline-pbf-lambda",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / ${WORKGROUP_SIZE})` },
};

const passPbfDelta: ComputePassSchema = {
  name: "pass-pbf-delta",
  type: "compute",
  pipelineRef: "pipeline-pbf-delta",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / ${WORKGROUP_SIZE})` },
};

const passApplyDelta: ComputePassSchema = {
  name: "pass-apply-delta",
  type: "compute",
  pipelineRef: "pipeline-apply-delta",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / ${WORKGROUP_SIZE})` },
};

const passEpilogue: ComputePassSchema = {
  name: "pass-epilogue",
  type: "compute",
  pipelineRef: "pipeline-epilogue",
  bindGroups: [{ group: 0, bindGroupRef: "bg-shared" }],
  dispatch: { expr: `ceil(${NUM_PARTICLES} / ${WORKGROUP_SIZE})` },
};

// ============================================================================
// RenderGraph 定义
// ============================================================================

const mainRenderGraph: RenderGraphSchema = {
  name: "main-simulation-graph",
  nodes: [
    { name: "node-prologue", passRef: "pass-prologue" },
    {
      name: "node-pbf-iterations",
      kind: "subgraph",
      graphRef: "pbf-iteration-graph",
      iterations: { param: "pbfIterations" },
      dependencies: ["node-prologue"],
    },
    { name: "node-epilogue", passRef: "pass-epilogue", dependencies: ["node-pbf-iterations"] },
  ],
};

const pbfIterationRenderGraph: RenderGraphSchema = {
  name: "pbf-iteration-graph",
  nodes: [
    { name: "node-clear-grid", passRef: "pass-clear-grid" },
    { name: "node-build-grid", passRef: "pass-build-grid", dependencies: ["node-clear-grid"] },
    { name: "node-pbf-lambda", passRef: "pass-pbf-lambda", dependencies: ["node-build-grid"] },
    { name: "node-pbf-delta", passRef: "pass-pbf-delta", dependencies: ["node-pbf-lambda"] },
    { name: "node-apply-delta", passRef: "pass-apply-delta", dependencies: ["node-pbf-delta"] },
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
  },

  bindGroups: {
    "bg-shared": bgShared,
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
    "pbf-iteration-graph": pbfIterationRenderGraph,
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
    .addBindGroup(bgShared)
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
    .addRenderGraph(mainRenderGraph)
    .addRenderGraph(pbfIterationRenderGraph);

  return builder.build("PBF-WebGPU-Simulation", "1.0.0");
}
