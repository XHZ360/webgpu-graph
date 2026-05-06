import "./styles.css";

import { mountPbfDemo } from "./pbfDemo.ts";

type FatalContext = {
  reason: string;
  details?: string;
};

const APP_SHELL = `
  <main class="page">
    <section class="hero">
      <p class="hero__body">Schema-driven Position Based Fluids running through the preview runtime.</p>
      <h1 class="hero__title">WebGPU PBF Demo</h1>
      <p class="hero__body">This shell exposes runtime support, simulation state, and basic controls while the compute demo owns behavior.</p>
    </section>

    <section class="demo" aria-live="polite">
      <canvas class="demo__canvas" aria-label="Particle simulation canvas"></canvas>

      <aside class="demo__sidebar">
        <div class="demo__status">
          <ul class="status-list">
            <li>WebGPU support <strong data-field="support">Checking</strong></li>
            <li>Run state <strong data-field="runState">Booting</strong></li>
            <li>Frames <strong data-field="frameCount">0</strong></li>
            <li>Particles <strong data-field="particleCount">0</strong></li>
          </ul>
        </div>

        <div class="demo__controls">
          <button type="button" data-action="toggle">Pause</button>
          <button type="button" data-action="reset">Reset</button>
        </div>

        <p class="demo__message">Initializing WebGPU simulation.</p>
      </aside>
    </section>
  </main>
`;

function showFatalError(target: HTMLElement, context: FatalContext): void {
  target.innerHTML = `
    <main class="page">
      <section class="hero">
        <p class="hero__body">Schema-driven Position Based Fluids running through the preview runtime.</p>
        <h1 class="hero__title">WebGPU PBF Demo</h1>
        <p class="hero__body">The demo could not finish initialization.</p>
      </section>

      <section class="demo" aria-live="assertive">
        <div class="demo__sidebar">
          <div class="demo__status">
            <ul class="status-list">
              <li>WebGPU support <strong data-field="support">Error</strong></li>
              <li>Run state <strong data-field="runState">Failed</strong></li>
              <li>Frames <strong data-field="frameCount">0</strong></li>
              <li>Particles <strong data-field="particleCount">0</strong></li>
            </ul>
          </div>

          <p class="demo__message"><strong>${escapeHtml(context.reason)}</strong>${context.details ? `<br />${escapeHtml(context.details)}` : ""}</p>
        </div>
      </section>
    </main>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return undefined;
}

function bootstrap(): void {
  const app = document.querySelector<HTMLElement>("#app");

  if (!app) {
    document.body.innerHTML = "";

    const fallbackRoot = document.createElement("div");
    document.body.append(fallbackRoot);
    showFatalError(fallbackRoot, {
      reason: "Missing application root.",
      details: "Expected to find a #app element before mounting the demo.",
    });

    return;
  }

  app.innerHTML = APP_SHELL;

  try {
    const handle = mountPbfDemo(app);

    void Promise.resolve(handle).catch((error: unknown) => {
      showFatalError(app, {
        reason: "Failed to mount the PBF demo.",
        details: toErrorDetails(error),
      });
    });
  } catch (error) {
    showFatalError(app, {
      reason: "Failed to mount the PBF demo.",
      details: toErrorDetails(error),
    });
  }
}

bootstrap();
