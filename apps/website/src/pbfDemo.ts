import {
  createPbfInitialParticleState,
  createPbfSimulationSchema,
  packPbfSimulationParams,
  PBF_DEFAULT_SIMULATION_PARAMS,
  PBF_SIMULATION_METADATA,
  type PbfSimulationParams,
} from "schema/examples/pbf-simulation";
import { DefaultSchemaValidator, type WebGpuSimulationSchema } from "schema";
import { SimulationRunner, createDispatchExecutionContext, getRequiredDeviceLimits } from "preview";
import { ParticleCanvasRenderer } from "./render2d.ts";

export interface PbfDemoHandle {
  acceptPreviewSchema(handoff: PbfPreviewSchemaHandoff): Promise<PbfPreviewAcceptance>;
  dispose(): void;
}

export interface PbfPreviewSchemaHandoff {
  schema: WebGpuSimulationSchema;
  metadata: {
    draftVersion: number;
    dirty: boolean;
    selectedId: string | null;
    selectedType: string | null;
  };
}

export type PbfPreviewAcceptance = { ok: true; message: string } | { ok: false; message: string };

interface DemoDom {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
  message: HTMLDivElement;
  toggleButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  solverModeSelect: HTMLSelectElement;
  iterInput: HTMLInputElement;
  iterValue: HTMLSpanElement;
  hInput: HTMLInputElement;
  hValue: HTMLSpanElement;
  neighborRadiusInput: HTMLInputElement;
  neighborRadiusValue: HTMLSpanElement;
  lambdaEpsInput: HTMLInputElement;
  lambdaEpsValue: HTMLSpanElement;
  corrKInput: HTMLInputElement;
  corrKValue: HTMLSpanElement;
  timeDeltaInput: HTMLInputElement;
  timeDeltaValue: HTMLSpanElement;
  massInput: HTMLInputElement;
  massValue: HTMLSpanElement;
  rho0Input: HTMLInputElement;
  rho0Value: HTMLSpanElement;
  particleRadiusInput: HTMLInputElement;
  particleRadiusValue: HTMLSpanElement;
  particleCountInput: HTMLInputElement;
  particleCountValueLabel: HTMLSpanElement;
  boundaryModeSelect: HTMLSelectElement;
  bezierControls: HTMLDivElement;
  boundaryHalfHeightInput: HTMLInputElement;
  boundaryHalfHeightValue: HTMLSpanElement;
  boundaryNeckWidthInput: HTMLInputElement;
  boundaryNeckWidthValue: HTMLSpanElement;
  boundaryEndWidthInput: HTMLInputElement;
  boundaryEndWidthValue: HTMLSpanElement;
  viscosityEnabledInput: HTMLInputElement;
  viscosityCInput: HTMLInputElement;
  viscosityCValue: HTMLSpanElement;
  readbackInput: HTMLInputElement;
  readbackValue: HTMLSpanElement;
  supportValue: HTMLElement;
  runStateValue: HTMLElement;
  frameCountValue: HTMLElement;
  particleCountValue: HTMLElement;
}

interface PersistedParams {
  iter: string;
  h: string;
  neighborRadius: string;
  lambdaEps: string;
  corrK: string;
  timeDelta: string;
  mass: string;
  rho0: string;
  particleRadius: string;
  boundaryMode: "box" | "bezier";
  boundaryHalfHeight: string;
  boundaryNeckWidth: string;
  boundaryEndWidth: string;
  viscosityEnabled: boolean;
  viscosityC: string;
  readback: string;
}

interface SimulationState {
  device: GPUDevice;
  runner: SimulationRunner;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const REBUILD_DEBOUNCE_MS = 180;
const SCREEN_TO_WORLD_RATIO = 10;
const SESSION_KEY = "website-pbf-demo-params";
const STATUS_SUPPORT_PENDING = "Checking";
const STATUS_SUPPORT_READY = "Supported";
const STATUS_SUPPORT_UNAVAILABLE = "Unavailable";
const STATUS_RUN_RUNNING = "Running";
const STATUS_RUN_PAUSED = "Paused";
const STATUS_RUN_STOPPED = "Stopped";
const STATUS_RUN_ERROR = "Error";
const HELP_TEXT =
  "This demo executes the schema-defined PBF compute graph on WebGPU and renders positions through a CPU readback path into a 2D canvas.";
const PBF_REQUIRED_BUFFERS = [
  "positions",
  "oldPositions",
  "velocities",
  "positionDeltas",
  "gridCounts",
  "grid2Particles",
  "neighborCounts",
  "neighbors",
  "lambdas",
  "simParams",
];
const PBF_REQUIRED_PASSES = [
  "pass-prologue",
  "pass-clear-grid",
  "pass-build-grid",
  "pass-pbf-lambda",
  "pass-pbf-delta",
  "pass-apply-delta",
  "pass-epilogue",
];
const PBF_MAIN_GRAPH = "main-simulation-graph";
const PBF_ITERATION_GRAPH = "pbf-iteration-graph";
const PBF_SHARED_BIND_GROUP = "bg-shared";

function validatePbfRuntimeCompatibility(schema: WebGpuSimulationSchema): PbfPreviewAcceptance {
  const missingBuffers = PBF_REQUIRED_BUFFERS.filter((name) => !schema.buffers[name]);
  if (missingBuffers.length > 0) {
    return {
      ok: false,
      message: `Preview handoff rejected: schema is not compatible with the PBF runtime; missing buffers: ${missingBuffers.join(", ")}.`,
    };
  }

  const missingPasses = PBF_REQUIRED_PASSES.filter((name) => !schema.passes[name]);
  if (missingPasses.length > 0) {
    return {
      ok: false,
      message: `Preview handoff rejected: schema is not compatible with the PBF runtime; missing passes: ${missingPasses.join(", ")}.`,
    };
  }

  if (schema.mainGraphRef !== PBF_MAIN_GRAPH || !schema.renderGraphs[PBF_MAIN_GRAPH]) {
    return {
      ok: false,
      message:
        "Preview handoff rejected: schema is not compatible with the PBF runtime; main-simulation-graph must be the main graph.",
    };
  }

  if (!schema.renderGraphs[PBF_ITERATION_GRAPH]) {
    return {
      ok: false,
      message:
        "Preview handoff rejected: schema is not compatible with the PBF runtime; pbf-iteration-graph is missing.",
    };
  }

  const passesMissingSharedBindGroup = PBF_REQUIRED_PASSES.filter((name) => {
    const pass = schema.passes[name];
    return (
      pass.type !== "compute" ||
      !pass.bindGroups.some((binding) => binding.bindGroupRef === PBF_SHARED_BIND_GROUP)
    );
  });
  if (passesMissingSharedBindGroup.length > 0) {
    return {
      ok: false,
      message: `Preview handoff rejected: schema is not compatible with the PBF runtime; passes missing ${PBF_SHARED_BIND_GROUP}: ${passesMissingSharedBindGroup.join(", ")}.`,
    };
  }

  return { ok: true, message: "Schema satisfies the PBF runtime compatibility guard." };
}

function setSliderLabel(input: HTMLInputElement, label: HTMLElement, digits: number): void {
  label.textContent = Number(input.value).toFixed(digits);
}

function collectParams(dom: DemoDom): PersistedParams {
  return {
    iter: dom.iterInput.value,
    h: dom.hInput.value,
    neighborRadius: dom.neighborRadiusInput.value,
    lambdaEps: dom.lambdaEpsInput.value,
    corrK: dom.corrKInput.value,
    timeDelta: dom.timeDeltaInput.value,
    mass: dom.massInput.value,
    rho0: dom.rho0Input.value,
    particleRadius: dom.particleRadiusInput.value,
    boundaryMode: dom.boundaryModeSelect.value as "box" | "bezier",
    boundaryHalfHeight: dom.boundaryHalfHeightInput.value,
    boundaryNeckWidth: dom.boundaryNeckWidthInput.value,
    boundaryEndWidth: dom.boundaryEndWidthInput.value,
    viscosityEnabled: dom.viscosityEnabledInput.checked,
    viscosityC: dom.viscosityCInput.value,
    readback: dom.readbackInput.value,
  };
}

function applyParams(dom: DemoDom, params: Partial<PersistedParams>): void {
  if (params.iter !== undefined) dom.iterInput.value = params.iter;
  if (params.h !== undefined) dom.hInput.value = params.h;
  if (params.neighborRadius !== undefined) dom.neighborRadiusInput.value = params.neighborRadius;
  if (params.lambdaEps !== undefined) dom.lambdaEpsInput.value = params.lambdaEps;
  if (params.corrK !== undefined) dom.corrKInput.value = params.corrK;
  if (params.timeDelta !== undefined) dom.timeDeltaInput.value = params.timeDelta;
  if (params.mass !== undefined) dom.massInput.value = params.mass;
  if (params.rho0 !== undefined) dom.rho0Input.value = params.rho0;
  if (params.particleRadius !== undefined) dom.particleRadiusInput.value = params.particleRadius;
  if (params.boundaryMode !== undefined) dom.boundaryModeSelect.value = params.boundaryMode;
  if (params.boundaryHalfHeight !== undefined) {
    dom.boundaryHalfHeightInput.value = params.boundaryHalfHeight;
  }
  if (params.boundaryNeckWidth !== undefined) {
    dom.boundaryNeckWidthInput.value = params.boundaryNeckWidth;
  }
  if (params.boundaryEndWidth !== undefined) {
    dom.boundaryEndWidthInput.value = params.boundaryEndWidth;
  }
  if (params.viscosityEnabled !== undefined) {
    dom.viscosityEnabledInput.checked = params.viscosityEnabled;
  }
  if (params.viscosityC !== undefined) dom.viscosityCInput.value = params.viscosityC;
  if (params.readback !== undefined) dom.readbackInput.value = params.readback;
}

function loadParamsFromSession(dom: DemoDom): void {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return;
    }
    applyParams(dom, JSON.parse(raw) as Partial<PersistedParams>);
  } catch {
    // Ignore malformed or unavailable session storage.
  }
}

function saveParamsToSession(dom: DemoDom): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(collectParams(dom)));
  } catch {
    // Ignore storage failures to avoid breaking simulation.
  }
}

function syncBoundaryControlVisibility(dom: DemoDom): void {
  dom.bezierControls.classList.toggle("hidden", dom.boundaryModeSelect.value !== "bezier");
}

function syncParameterLabels(dom: DemoDom): void {
  setSliderLabel(dom.iterInput, dom.iterValue, 0);
  setSliderLabel(dom.hInput, dom.hValue, 2);
  setSliderLabel(dom.neighborRadiusInput, dom.neighborRadiusValue, 2);
  setSliderLabel(dom.lambdaEpsInput, dom.lambdaEpsValue, 0);
  setSliderLabel(dom.corrKInput, dom.corrKValue, 4);
  setSliderLabel(dom.timeDeltaInput, dom.timeDeltaValue, 3);
  setSliderLabel(dom.massInput, dom.massValue, 2);
  setSliderLabel(dom.rho0Input, dom.rho0Value, 2);
  setSliderLabel(dom.particleRadiusInput, dom.particleRadiusValue, 1);
  setSliderLabel(dom.particleCountInput, dom.particleCountValueLabel, 0);
  setSliderLabel(dom.boundaryHalfHeightInput, dom.boundaryHalfHeightValue, 1);
  setSliderLabel(dom.boundaryNeckWidthInput, dom.boundaryNeckWidthValue, 1);
  setSliderLabel(dom.boundaryEndWidthInput, dom.boundaryEndWidthValue, 1);
  setSliderLabel(dom.viscosityCInput, dom.viscosityCValue, 3);
  setSliderLabel(dom.readbackInput, dom.readbackValue, 0);
  syncBoundaryControlVisibility(dom);
}

function readSimulationOverrides(dom: DemoDom): Partial<PbfSimulationParams> {
  return {
    pbfIterations: Math.max(1, Math.floor(Number(dom.iterInput.value))),
    h: Number(dom.hInput.value),
    neighborRadius: Number(dom.neighborRadiusInput.value),
    lambdaEpsilon: Number(dom.lambdaEpsInput.value),
    corrK: Number(dom.corrKInput.value),
    timeDelta: Number(dom.timeDeltaInput.value),
    mass: Number(dom.massInput.value),
    rho0: Number(dom.rho0Input.value),
    particleRadiusInWorld: Number(dom.particleRadiusInput.value) / SCREEN_TO_WORLD_RATIO,
    boundaryMode: dom.boundaryModeSelect.value === "bezier" ? 1 : 0,
    boundaryHalfHeight: Number(dom.boundaryHalfHeightInput.value),
    boundaryBezierNeckWidth: Number(dom.boundaryNeckWidthInput.value),
    boundaryBezierTopWidth: Number(dom.boundaryEndWidthInput.value),
    boundaryBezierBottomWidth: Number(dom.boundaryEndWidthInput.value),
    viscosityEnabled: dom.viscosityEnabledInput.checked ? 1 : 0,
    viscosityC: Number(dom.viscosityCInput.value),
  };
}

export async function mountPbfDemo(container: HTMLElement): Promise<PbfDemoHandle> {
  const dom = createDemoDom();
  container.replaceChildren(dom.root);
  loadParamsFromSession(dom);
  syncParameterLabels(dom);

  let simulationParams = {
    ...PBF_DEFAULT_SIMULATION_PARAMS,
    ...readSimulationOverrides(dom),
  };

  const renderer = new ParticleCanvasRenderer({
    canvas: dom.canvas,
    worldWidth: simulationParams.boundaryX,
    worldHeight: simulationParams.boundaryY,
    particleRadius: simulationParams.particleRadiusInWorld,
    boundaryMode: simulationParams.boundaryMode,
    boundaryHalfHeight: simulationParams.boundaryHalfHeight,
    boundaryBezierNeckWidth: simulationParams.boundaryBezierNeckWidth,
    boundaryBezierTopWidth: simulationParams.boundaryBezierTopWidth,
    boundaryBezierBottomWidth: simulationParams.boundaryBezierBottomWidth,
  });

  let disposed = false;
  let running = true;
  let resetting = false;
  let rafId = 0;
  let generation = 0;
  let rebuildTimer = 0;
  let simulation: SimulationState | null = null;
  let stepPromise: Promise<void> | null = null;
  let activeSchema: WebGpuSimulationSchema = createPbfSimulationSchema();

  const teardownRunner = (state: SimulationState | null): void => {
    state?.runner.dispose();
  };

  const setMessage = (message: string): void => {
    dom.message.textContent = message;
  };

  const reportWarning = (message: string): void => {
    console.warn(message);
    setMessage(`${HELP_TEXT} ${message}`);
  };

  const setSupportState = (value: string): void => {
    dom.supportValue.textContent = value;
  };

  const setRunState = (value: string): void => {
    dom.runStateValue.textContent = value;
  };

  const setFrameCount = (value: number): void => {
    dom.frameCountValue.textContent = `${value}`;
  };

  const syncControls = (): void => {
    dom.toggleButton.disabled = simulation === null || resetting || disposed;
    dom.resetButton.disabled = simulation === null || resetting || disposed;
    dom.toggleButton.textContent = running ? "Pause" : "Resume";
    setRunState(
      simulation === null ? STATUS_RUN_STOPPED : running ? STATUS_RUN_RUNNING : STATUS_RUN_PAUSED,
    );
  };

  const failDemo = (message: string): void => {
    const activeSimulation = simulation;
    simulation = null;
    running = false;
    setSupportState(activeSimulation === null ? STATUS_SUPPORT_UNAVAILABLE : STATUS_SUPPORT_READY);
    setRunState(STATUS_RUN_ERROR);
    setMessage(message);
    dom.toggleButton.disabled = true;
    dom.resetButton.disabled = true;
  };

  const initializeBuffers = (state: SimulationState): void => {
    const initialState = createPbfInitialParticleState(simulationParams);
    const simParams = packPbfSimulationParams(simulationParams);

    state.runner.initialize();
    state.runner.writeBuffer("positions", initialState.positions);
    state.runner.writeBuffer("oldPositions", initialState.oldPositions);
    state.runner.writeBuffer("velocities", initialState.velocities);
    state.runner.writeBuffer(
      "positionDeltas",
      new Float32Array(PBF_SIMULATION_METADATA.particleCount * 2),
    );
    state.runner.writeBuffer(
      "gridCounts",
      new Uint32Array(PBF_SIMULATION_METADATA.gridWidth * PBF_SIMULATION_METADATA.gridHeight),
    );
    state.runner.writeBuffer(
      "grid2Particles",
      new Uint32Array(
        PBF_SIMULATION_METADATA.gridWidth *
          PBF_SIMULATION_METADATA.gridHeight *
          PBF_SIMULATION_METADATA.maxParticlesPerCell,
      ),
    );
    state.runner.writeBuffer(
      "neighborCounts",
      new Uint32Array(PBF_SIMULATION_METADATA.particleCount),
    );
    state.runner.writeBuffer(
      "neighbors",
      new Int32Array(PBF_SIMULATION_METADATA.particleCount * PBF_SIMULATION_METADATA.maxNeighbors),
    );
    state.runner.writeBuffer("lambdas", new Float32Array(PBF_SIMULATION_METADATA.particleCount));
    state.runner.writeBuffer("simParams", simParams);

    setFrameCount(0);
    renderer.render(initialState.positions);
  };

  const requestDevice = async (schema: WebGpuSimulationSchema): Promise<GPUDevice | null> => {
    if (!("gpu" in navigator)) {
      return null;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return null;
    }

    const requiredLimits = getRequiredDeviceLimits(schema);

    if (
      requiredLimits.maxStorageBuffersPerShaderStage !== undefined &&
      adapter.limits.maxStorageBuffersPerShaderStage <
        requiredLimits.maxStorageBuffersPerShaderStage
    ) {
      throw new Error("This adapter does not satisfy the schema-required WebGPU limits.");
    }

    if (requiredLimits.maxStorageBuffersPerShaderStage !== undefined) {
      return adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: requiredLimits.maxStorageBuffersPerShaderStage,
        },
      });
    }

    return adapter.requestDevice();
  };

  const bootSimulation = async (): Promise<void> => {
    setSupportState(STATUS_SUPPORT_PENDING);
    setRunState(STATUS_RUN_STOPPED);
    setFrameCount(0);
    setMessage(HELP_TEXT);
    dom.particleCountValue.textContent = `${PBF_SIMULATION_METADATA.particleCount}`;

    const device = await requestDevice(activeSchema);
    if (!device) {
      running = false;
      setSupportState(STATUS_SUPPORT_UNAVAILABLE);
      setRunState(STATUS_RUN_STOPPED);
      setMessage(
        "WebGPU is unavailable in this browser or no compatible adapter/device was found.",
      );
      dom.toggleButton.disabled = true;
      dom.resetButton.disabled = true;
      return;
    }

    void device.lost.then((info) => {
      if (disposed) {
        return;
      }
      const reason = info.message ? ` ${info.message}` : "";
      failDemo(`WebGPU device was lost.${reason}`.trim());
    });

    device.addEventListener("uncapturederror", (event) => {
      if (disposed) {
        return;
      }
      reportWarning(`WebGPU reported an uncaptured error: ${event.error.message}`);
    });

    const state: SimulationState = {
      device,
      runner: new SimulationRunner({
        schema: activeSchema,
        device,
        context: createDispatchExecutionContext({
          params: {
            particleCount: PBF_SIMULATION_METADATA.particleCount,
            pbfIterations: simulationParams.pbfIterations,
            workgroupSize: PBF_SIMULATION_METADATA.workgroupSize,
          },
          reportError(message) {
            reportWarning(message);
          },
        }),
      }),
    };

    simulation = state;
    running = true;
    initializeBuffers(state);
    setSupportState(STATUS_SUPPORT_READY);
    syncControls();
  };

  const stepFrame = async (frameGeneration: number): Promise<void> => {
    const state = simulation;
    if (!state || !running || resetting || disposed) {
      return;
    }

    const commandBuffer = state.runner.step();
    state.device.queue.submit([commandBuffer]);

    const frameCount = state.runner.getFrameCount();
    setFrameCount(frameCount);

    const readbackEvery = Math.max(1, Math.floor(Number(dom.readbackInput.value)));
    if (frameCount === 1 || frameCount % readbackEvery === 0) {
      const positions = await state.runner.readBuffer("positions");
      if (disposed || frameGeneration !== generation) {
        return;
      }
      if (!(positions instanceof Float32Array)) {
        throw new Error("Unexpected positions buffer type returned during readback.");
      }
      renderer.render(positions);
    }
  };

  const tick = (): void => {
    if (disposed) {
      return;
    }

    rafId = window.requestAnimationFrame(tick);

    if (!running || resetting || simulation === null || stepPromise) {
      return;
    }

    const frameGeneration = generation;
    stepPromise = stepFrame(frameGeneration)
      .catch((error) => {
        if (disposed) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        failDemo(`Failed to execute the PBF demo runtime: ${message}`);
      })
      .finally(() => {
        stepPromise = null;
      });
  };

  const resetSimulation = async (nextSchema = activeSchema): Promise<void> => {
    if (!simulation || resetting || disposed) {
      return;
    }

    resetting = true;
    generation += 1;
    syncControls();

    try {
      await stepPromise;

      const previous = simulation;
      activeSchema = nextSchema;
      simulationParams = {
        ...PBF_DEFAULT_SIMULATION_PARAMS,
        ...readSimulationOverrides(dom),
      };
      const next: SimulationState = {
        device: previous.device,
        runner: new SimulationRunner({
          schema: activeSchema,
          device: previous.device,
          context: createDispatchExecutionContext({
            params: {
              particleCount: PBF_SIMULATION_METADATA.particleCount,
              pbfIterations: simulationParams.pbfIterations,
              workgroupSize: PBF_SIMULATION_METADATA.workgroupSize,
            },
            reportError(message) {
              reportWarning(message);
            },
          }),
        }),
      };

      initializeBuffers(next);
      simulation = next;
      teardownRunner(previous);
      setMessage(HELP_TEXT);
      setSupportState(STATUS_SUPPORT_READY);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failDemo(`Failed to reset the PBF demo runtime: ${message}`);
    } finally {
      resetting = false;
      syncControls();
    }
  };

  const acceptPreviewSchema = async (
    handoff: PbfPreviewSchemaHandoff,
  ): Promise<PbfPreviewAcceptance> => {
    const validation = new DefaultSchemaValidator().validate(handoff.schema);
    if (!validation.valid) {
      return {
        ok: false,
        message: `Preview handoff rejected by runtime validation: ${validation.errors
          .map((diagnostic) => diagnostic.message)
          .join("; ")}`,
      };
    }

    const compatibility = validatePbfRuntimeCompatibility(handoff.schema);
    if (!compatibility.ok) {
      return compatibility;
    }

    if (!simulation || resetting || disposed) {
      return { ok: false, message: "Preview runtime is not ready to accept a schema." };
    }

    await resetSimulation(handoff.schema);

    if (!simulation) {
      return { ok: false, message: "Preview runtime failed while applying the accepted schema." };
    }

    return {
      ok: true,
      message: `Preview runtime accepted draft v${handoff.metadata.draftVersion}; runner was recreated from the validated schema.`,
    };
  };

  const onToggleClick = (): void => {
    if (!simulation || resetting || disposed) {
      return;
    }

    running = !running;
    syncControls();
  };

  const onResetClick = (): void => {
    void resetSimulation();
  };

  const requestSimulationRebuild = (immediate = false): void => {
    saveParamsToSession(dom);

    if (rebuildTimer !== 0) {
      window.clearTimeout(rebuildTimer);
      rebuildTimer = 0;
    }

    const runRebuild = (): void => {
      void resetSimulation();
    };

    if (immediate) {
      runRebuild();
      return;
    }

    setRunState("Queued");
    rebuildTimer = window.setTimeout(() => {
      rebuildTimer = 0;
      runRebuild();
    }, REBUILD_DEBOUNCE_MS);
  };

  const rebuildLabelInputs: Array<[HTMLInputElement, HTMLElement, number]> = [
    [dom.iterInput, dom.iterValue, 0],
    [dom.hInput, dom.hValue, 2],
    [dom.neighborRadiusInput, dom.neighborRadiusValue, 2],
    [dom.lambdaEpsInput, dom.lambdaEpsValue, 0],
    [dom.corrKInput, dom.corrKValue, 4],
    [dom.timeDeltaInput, dom.timeDeltaValue, 3],
    [dom.massInput, dom.massValue, 2],
    [dom.rho0Input, dom.rho0Value, 2],
    [dom.particleRadiusInput, dom.particleRadiusValue, 1],
    [dom.boundaryHalfHeightInput, dom.boundaryHalfHeightValue, 1],
    [dom.boundaryNeckWidthInput, dom.boundaryNeckWidthValue, 1],
    [dom.boundaryEndWidthInput, dom.boundaryEndWidthValue, 1],
    [dom.viscosityCInput, dom.viscosityCValue, 3],
  ];

  for (const [input, label, digits] of rebuildLabelInputs) {
    input.addEventListener("input", () => {
      setSliderLabel(input, label, digits);
      requestSimulationRebuild();
    });
  }

  dom.boundaryModeSelect.addEventListener("change", () => {
    syncBoundaryControlVisibility(dom);
    requestSimulationRebuild();
  });

  dom.viscosityEnabledInput.addEventListener("change", () => {
    requestSimulationRebuild();
  });

  dom.readbackInput.addEventListener("input", () => {
    setSliderLabel(dom.readbackInput, dom.readbackValue, 0);
    saveParamsToSession(dom);
  });

  dom.toggleButton.addEventListener("click", onToggleClick);
  dom.resetButton.addEventListener("click", onResetClick);

  try {
    await bootSimulation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failDemo(`Failed to initialize WebGPU for the PBF demo: ${message}`);
  }

  syncControls();
  tick();

  return {
    acceptPreviewSchema,
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      running = false;
      generation += 1;
      if (rebuildTimer !== 0) {
        window.clearTimeout(rebuildTimer);
      }
      window.cancelAnimationFrame(rafId);
      dom.toggleButton.removeEventListener("click", onToggleClick);
      dom.resetButton.removeEventListener("click", onResetClick);
      renderer.dispose();

      const activeSimulation = simulation;
      simulation = null;

      if (stepPromise) {
        void stepPromise.finally(() => {
          teardownRunner(activeSimulation);
        });
      } else {
        teardownRunner(activeSimulation);
      }
    },
  };
}

function createDemoDom(): DemoDom {
  const root = document.createElement("div");
  root.className = "page";

  root.innerHTML = `
    <section class="hero">
      <h1 class="hero__title">Position-Based Fluids Demo</h1>
      <p class="hero__body">A schema-driven WebGPU compute simulation with CPU readback visualization.</p>
    </section>
    <section class="demo">
      <aside class="demo__sidebar">
        <!-- Parameter Controls -->
        <div class="row">
          <div class="row-head">
            <label for="solverMode">Solver Mode</label>
          </div>
          <select id="solverMode" disabled>
            <option value="pbf">PBF</option>
          </select>
        </div>

        <div class="row">
          <div class="row-head">
            <label id="iterLabel" for="iter">PBF Iterations</label>
            <span class="value" id="iterVal">5</span>
          </div>
          <input id="iter" type="range" min="1" max="12" step="1" value="5" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="hValInput">Smoothing Radius h</label>
            <span class="value" id="hVal">1.10</span>
          </div>
          <input id="hValInput" type="range" min="0.80" max="1.60" step="0.01" value="1.10" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="neighborRadius">Neighbor Radius</label>
            <span class="value" id="neighborRadiusVal">1.16</span>
          </div>
          <input id="neighborRadius" type="range" min="0.90" max="2.00" step="0.01" value="1.16" />
        </div>

        <div class="row">
          <div class="row-head">
            <label id="lambdaEpsLabel" for="lambdaEps">lambda epsilon</label>
            <span class="value" id="lambdaEpsVal">100</span>
          </div>
          <input id="lambdaEps" type="range" min="10" max="300" step="1" value="100" />
        </div>

        <div class="row">
          <div class="row-head">
            <label id="corrKLabel" for="corrK">Tensile Instability corrK</label>
            <span class="value" id="corrKVal">0.0010</span>
          </div>
          <input id="corrK" type="range" min="0.0000" max="0.0100" step="0.0001" value="0.0010" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="timeDelta">Time Delta dt</label>
            <span class="value" id="timeDeltaVal">0.050</span>
          </div>
          <input id="timeDelta" type="range" min="0.010" max="0.080" step="0.001" value="0.050" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="mass">Particle Mass</label>
            <span class="value" id="massVal">1.00</span>
          </div>
          <input id="mass" type="range" min="0.50" max="2.00" step="0.05" value="1.00" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="rho0">Rest Density rho0</label>
            <span class="value" id="rho0Val">1.00</span>
          </div>
          <input id="rho0" type="range" min="0.50" max="2.00" step="0.05" value="1.00" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="particleRadius">Particle Radius (px)</label>
            <span class="value" id="particleRadiusVal">3.0</span>
          </div>
          <input id="particleRadius" type="range" min="1.0" max="8.0" step="0.1" value="3.0" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="particleCount">Particle Count</label>
            <span class="value" id="particleCountVal">1200</span>
          </div>
          <input id="particleCount" type="range" min="1" max="2400" step="1" value="1200" />
        </div>

        <div class="group-title">Boundary</div>

        <div class="row">
          <div class="row-head">
            <label for="boundaryMode">Boundary Mode</label>
          </div>
          <select id="boundaryMode">
            <option value="box">Box</option>
            <option value="bezier">Bezier</option>
          </select>
        </div>

        <div id="bezierControls">
          <div class="row">
            <div class="row-head">
              <label for="boundaryHalfHeight">Half Height</label>
              <span class="value" id="boundaryHalfHeightVal">18.0</span>
            </div>
            <input id="boundaryHalfHeight" type="range" min="2.0" max="20.0" step="0.1" value="18.0" />
          </div>

          <div class="row">
            <div class="row-head">
              <label for="boundaryNeckWidth">Neck Width</label>
              <span class="value" id="boundaryNeckWidthVal">20.0</span>
            </div>
            <input id="boundaryNeckWidth" type="range" min="1.0" max="80.0" step="0.1" value="20.0" />
          </div>

          <div class="row">
            <div class="row-head">
              <label for="boundaryEndWidth">End Width</label>
              <span class="value" id="boundaryEndWidthVal">80.0</span>
            </div>
            <input id="boundaryEndWidth" type="range" min="1.0" max="80.0" step="0.1" value="80.0" />
          </div>
        </div>

        <div class="switch-row">
          <label for="viscosityEnabled">Artificial Viscosity</label>
          <input id="viscosityEnabled" type="checkbox" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="viscosityC">Viscosity Strength</label>
            <span class="value" id="viscosityCVal">0.000</span>
          </div>
          <input id="viscosityC" type="range" min="0.000" max="4.000" step="0.010" value="0.000" />
        </div>

        <div class="row">
          <div class="row-head">
            <label for="readback">Readback Frames</label>
            <span class="value" id="readbackVal">2</span>
          </div>
          <input id="readback" type="range" min="1" max="6" step="1" value="2" />
        </div>

        <section class="demo__controls">
          <button type="button" data-action="toggle">Pause</button>
          <button type="button" data-action="reset">Reset</button>
        </section>

        <section class="demo__status">
          <ul class="status-list">
            <li>WebGPU: <strong data-field="support">${STATUS_SUPPORT_PENDING}</strong></li>
            <li>State: <strong data-field="runState">${STATUS_RUN_STOPPED}</strong></li>
            <li>Frames: <strong data-field="frameCount">0</strong></li>
            <li>Particles: <strong data-field="particleCount">${PBF_SIMULATION_METADATA.particleCount}</strong></li>
          </ul>
        </section>
        
        <div class="demo__message">${HELP_TEXT}</div>
      </aside>

      <section class="demo__stage">
        <canvas class="demo__canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"></canvas>
        <div class="tag">GPU Compute + 2D Render</div>
      </section>
    </section>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(".demo__canvas");
  const message = root.querySelector<HTMLDivElement>(".demo__message");
  const toggleButton = root.querySelector<HTMLButtonElement>('[data-action="toggle"]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]');
  const solverModeSelect = root.querySelector<HTMLSelectElement>("#solverMode");
  const iterInput = root.querySelector<HTMLInputElement>("#iter");
  const iterValue = root.querySelector<HTMLElement>("#iterVal");
  const hInput = root.querySelector<HTMLInputElement>("#hValInput");
  const hValue = root.querySelector<HTMLElement>("#hVal");
  const neighborRadiusInput = root.querySelector<HTMLInputElement>("#neighborRadius");
  const neighborRadiusValue = root.querySelector<HTMLElement>("#neighborRadiusVal");
  const lambdaEpsInput = root.querySelector<HTMLInputElement>("#lambdaEps");
  const lambdaEpsValue = root.querySelector<HTMLElement>("#lambdaEpsVal");
  const corrKInput = root.querySelector<HTMLInputElement>("#corrK");
  const corrKValue = root.querySelector<HTMLElement>("#corrKVal");
  const timeDeltaInput = root.querySelector<HTMLInputElement>("#timeDelta");
  const timeDeltaValue = root.querySelector<HTMLElement>("#timeDeltaVal");
  const massInput = root.querySelector<HTMLInputElement>("#mass");
  const massValue = root.querySelector<HTMLElement>("#massVal");
  const rho0Input = root.querySelector<HTMLInputElement>("#rho0");
  const rho0Value = root.querySelector<HTMLElement>("#rho0Val");
  const particleRadiusInput = root.querySelector<HTMLInputElement>("#particleRadius");
  const particleRadiusValue = root.querySelector<HTMLElement>("#particleRadiusVal");
  const particleCountValueLabel = root.querySelector<HTMLElement>("#particleCountVal");
  const particleCountInput = root.querySelector<HTMLInputElement>("#particleCount");
  const boundaryModeSelect = root.querySelector<HTMLSelectElement>("#boundaryMode");
  const bezierControls = root.querySelector<HTMLDivElement>("#bezierControls");
  const boundaryHalfHeightInput = root.querySelector<HTMLInputElement>("#boundaryHalfHeight");
  const boundaryHalfHeightValue = root.querySelector<HTMLElement>("#boundaryHalfHeightVal");
  const boundaryNeckWidthInput = root.querySelector<HTMLInputElement>("#boundaryNeckWidth");
  const boundaryNeckWidthValue = root.querySelector<HTMLElement>("#boundaryNeckWidthVal");
  const boundaryEndWidthInput = root.querySelector<HTMLInputElement>("#boundaryEndWidth");
  const boundaryEndWidthValue = root.querySelector<HTMLElement>("#boundaryEndWidthVal");
  const viscosityEnabledInput = root.querySelector<HTMLInputElement>("#viscosityEnabled");
  const viscosityCInput = root.querySelector<HTMLInputElement>("#viscosityC");
  const viscosityCValue = root.querySelector<HTMLElement>("#viscosityCVal");
  const readbackInput = root.querySelector<HTMLInputElement>("#readback");
  const readbackValue = root.querySelector<HTMLElement>("#readbackVal");
  const supportValue = root.querySelector<HTMLElement>('[data-field="support"]');
  const runStateValue = root.querySelector<HTMLElement>('[data-field="runState"]');
  const frameCountValue = root.querySelector<HTMLElement>('[data-field="frameCount"]');
  const particleCountValue = root.querySelector<HTMLElement>('[data-field="particleCount"]');

  if (
    !canvas ||
    !message ||
    !toggleButton ||
    !resetButton ||
    !solverModeSelect ||
    !iterInput ||
    !iterValue ||
    !hInput ||
    !hValue ||
    !neighborRadiusInput ||
    !neighborRadiusValue ||
    !lambdaEpsInput ||
    !lambdaEpsValue ||
    !corrKInput ||
    !corrKValue ||
    !timeDeltaInput ||
    !timeDeltaValue ||
    !massInput ||
    !massValue ||
    !rho0Input ||
    !rho0Value ||
    !particleRadiusInput ||
    !particleRadiusValue ||
    !particleCountInput ||
    !particleCountValueLabel ||
    !boundaryModeSelect ||
    !bezierControls ||
    !boundaryHalfHeightInput ||
    !boundaryHalfHeightValue ||
    !boundaryNeckWidthInput ||
    !boundaryNeckWidthValue ||
    !boundaryEndWidthInput ||
    !boundaryEndWidthValue ||
    !viscosityEnabledInput ||
    !viscosityCInput ||
    !viscosityCValue ||
    !readbackInput ||
    !readbackValue ||
    !supportValue ||
    !runStateValue ||
    !frameCountValue ||
    !particleCountValue
  ) {
    throw new Error("Failed to create the PBF demo DOM structure.");
  }

  return {
    root,
    canvas,
    message,
    toggleButton,
    resetButton,
    solverModeSelect,
    iterInput,
    iterValue,
    hInput,
    hValue,
    neighborRadiusInput,
    neighborRadiusValue,
    lambdaEpsInput,
    lambdaEpsValue,
    corrKInput,
    corrKValue,
    timeDeltaInput,
    timeDeltaValue,
    massInput,
    massValue,
    rho0Input,
    rho0Value,
    particleRadiusInput,
    particleRadiusValue,
    particleCountInput,
    particleCountValueLabel,
    boundaryModeSelect,
    bezierControls,
    boundaryHalfHeightInput,
    boundaryHalfHeightValue,
    boundaryNeckWidthInput,
    boundaryNeckWidthValue,
    boundaryEndWidthInput,
    boundaryEndWidthValue,
    viscosityEnabledInput,
    viscosityCInput,
    viscosityCValue,
    readbackInput,
    readbackValue,
    supportValue,
    runStateValue,
    frameCountValue,
    particleCountValue,
  };
}
