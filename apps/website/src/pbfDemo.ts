import {
  createPbfInitialParticleState,
  createPbfSimulationSchema,
  packPbfSimulationParams,
  PBF_DEFAULT_SIMULATION_PARAMS,
  PBF_SIMULATION_METADATA,
} from "schema/examples/pbf-simulation";
import { SimulationRunner, createDispatchExecutionContext, getRequiredDeviceLimits } from "preview";
import { ParticleCanvasRenderer } from "./render2d.ts";

export interface PbfDemoHandle {
  dispose(): void;
}

interface DemoDom {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
  message: HTMLDivElement;
  toggleButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  supportValue: HTMLElement;
  runStateValue: HTMLElement;
  frameCountValue: HTMLElement;
  particleCountValue: HTMLElement;
}

interface SimulationState {
  device: GPUDevice;
  runner: SimulationRunner;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const READBACK_INTERVAL = 2;
const STATUS_SUPPORT_PENDING = "Checking";
const STATUS_SUPPORT_READY = "Supported";
const STATUS_SUPPORT_UNAVAILABLE = "Unavailable";
const STATUS_RUN_RUNNING = "Running";
const STATUS_RUN_PAUSED = "Paused";
const STATUS_RUN_STOPPED = "Stopped";
const STATUS_RUN_ERROR = "Error";
const HELP_TEXT =
  "This demo executes the schema-defined PBF compute graph on WebGPU and renders positions through a CPU readback path into a 2D canvas.";

export async function mountPbfDemo(container: HTMLElement): Promise<PbfDemoHandle> {
  const dom = createDemoDom();
  container.replaceChildren(dom.root);

  const renderer = new ParticleCanvasRenderer({
    canvas: dom.canvas,
    worldWidth: PBF_DEFAULT_SIMULATION_PARAMS.boundaryX,
    worldHeight: PBF_DEFAULT_SIMULATION_PARAMS.boundaryY,
    particleRadius: PBF_DEFAULT_SIMULATION_PARAMS.particleRadiusInWorld,
  });

  let disposed = false;
  let running = true;
  let resetting = false;
  let rafId = 0;
  let generation = 0;
  let simulation: SimulationState | null = null;
  let stepPromise: Promise<void> | null = null;

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
    const initialState = createPbfInitialParticleState();
    const simParams = packPbfSimulationParams();

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

  const requestDevice = async (
    schema: ReturnType<typeof createPbfSimulationSchema>,
  ): Promise<GPUDevice | null> => {
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

    const schema = createPbfSimulationSchema();
    const device = await requestDevice(schema);
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
        schema,
        device,
        context: createDispatchExecutionContext({
          params: {
            particleCount: PBF_SIMULATION_METADATA.particleCount,
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

    if (frameCount === 1 || frameCount % READBACK_INTERVAL === 0) {
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

  const resetSimulation = async (): Promise<void> => {
    if (!simulation || resetting || disposed) {
      return;
    }

    resetting = true;
    generation += 1;
    syncControls();

    try {
      await stepPromise;

      const previous = simulation;
      const next: SimulationState = {
        device: previous.device,
        runner: new SimulationRunner({
          schema: createPbfSimulationSchema(),
          device: previous.device,
          context: createDispatchExecutionContext({
            params: {
              particleCount: PBF_SIMULATION_METADATA.particleCount,
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
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      running = false;
      generation += 1;
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
      <canvas class="demo__canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"></canvas>
      <aside class="demo__sidebar">
        <section class="demo__status">
          <ul class="status-list">
            <li>WebGPU: <span data-field="support">${STATUS_SUPPORT_PENDING}</span></li>
            <li>State: <span data-field="runState">${STATUS_RUN_STOPPED}</span></li>
            <li>Frames: <span data-field="frameCount">0</span></li>
            <li>Particles: <span data-field="particleCount">${PBF_SIMULATION_METADATA.particleCount}</span></li>
          </ul>
        </section>
        <section class="demo__controls">
          <button type="button" data-action="toggle">Pause</button>
          <button type="button" data-action="reset">Reset</button>
        </section>
        <div class="demo__message">${HELP_TEXT}</div>
      </aside>
    </section>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(".demo__canvas");
  const message = root.querySelector<HTMLDivElement>(".demo__message");
  const toggleButton = root.querySelector<HTMLButtonElement>('[data-action="toggle"]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]');
  const supportValue = root.querySelector<HTMLElement>('[data-field="support"]');
  const runStateValue = root.querySelector<HTMLElement>('[data-field="runState"]');
  const frameCountValue = root.querySelector<HTMLElement>('[data-field="frameCount"]');
  const particleCountValue = root.querySelector<HTMLElement>('[data-field="particleCount"]');

  if (
    !canvas ||
    !message ||
    !toggleButton ||
    !resetButton ||
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
    supportValue,
    runStateValue,
    frameCountValue,
    particleCountValue,
  };
}
