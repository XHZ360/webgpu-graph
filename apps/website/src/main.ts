import "./styles.css";

import { mountPbfDemo } from "./pbfDemo.ts";
import { mountSchemaDesigner } from "./schemaDesigner.ts";
import { mountSchemaInspector } from "./schemaInspector.ts";

type FatalContext = {
  reason: string;
  details?: string;
};

const APP_SHELL = `
  <div data-mount="pbf-demo"></div>
  <div data-mount="schema-designer"></div>
  <div data-mount="schema-inspector"></div>
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
  const demoMount = app.querySelector<HTMLElement>('[data-mount="pbf-demo"]');
  const designerMount = app.querySelector<HTMLElement>('[data-mount="schema-designer"]');
  const inspectorMount = app.querySelector<HTMLElement>('[data-mount="schema-inspector"]');

  if (!demoMount || !designerMount || !inspectorMount) {
    showFatalError(app, {
      reason: "Missing application mount point.",
      details:
        "Expected demo, schema designer, and schema inspector mount elements before initialization.",
    });
    return;
  }

  mountSchemaDesigner(designerMount);
  mountSchemaInspector(inspectorMount);

  try {
    const handle = mountPbfDemo(demoMount);

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
