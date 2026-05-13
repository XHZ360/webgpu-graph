import {
  applyEditorOperation,
  createEditorDraftSession,
  inspectSchema,
  requestDraftPreviewHandoff,
  type DraftPreviewHandoffMetadata,
  type EditorDraftSession,
  type EditorOperation,
  type EditorSelectionType,
  type SchemaInspection,
} from "editor";
import {
  BUFFER_USAGE,
  type ComputePassSchema,
  type RenderGraphNodeSchema,
  type WebGpuSimulationSchema,
} from "schema";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";

const SCRATCH_BUFFER = "designerScratchBuffer";
const SCRATCH_PASS = "designerScratchPass";
const SCRATCH_NODE = "designerScratchNode";
const MAIN_GRAPH = "main-simulation-graph";
const PIPELINE_REF = "pipeline-prologue";
const BIND_GROUP_REF = "bg-shared";

interface DesignerDom {
  root: HTMLElement;
  summary: HTMLElement;
  selection: HTMLElement;
  validation: HTMLElement;
  diagnostics: HTMLElement;
  buffers: HTMLElement;
  passes: HTMLElement;
  graphNodes: HTMLElement;
  previewGate: HTMLElement;
  previewButton: HTMLButtonElement;
  lastOperation: HTMLElement;
}

export interface SchemaDesignerPreviewHandoff {
  schema: WebGpuSimulationSchema;
  metadata: DraftPreviewHandoffMetadata;
}

export type SchemaDesignerPreviewResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export interface SchemaDesignerOptions {
  onPreviewHandoff?(handoff: SchemaDesignerPreviewHandoff): Promise<SchemaDesignerPreviewResult>;
  onCanvasStateChange?(state: SchemaDesignerCanvasState): void;
}

interface PreviewUiState {
  lastAcceptedDraftVersion: number | null;
  status: "synced" | "stale" | "pending" | "blocked" | "success" | "failure";
  message: string;
}

export interface SchemaDesignerCanvasState {
  schema: WebGpuSimulationSchema;
  diagnostics: EditorDraftSession["validation"]["diagnostics"];
  draftVersion: number;
  activePreviewDraftVersion: number | null;
  previewStatus: PreviewUiState["status"];
  previewMessage: string;
  previewStale: boolean;
  dirty: boolean;
  selectedId: string | null;
}

export interface PreviewGateInput {
  draftVersion: number;
  validationStatus: EditorDraftSession["validation"]["status"];
  previewState: PreviewUiState;
}

export interface PreviewGateState {
  status: PreviewUiState["status"];
  message: string;
  buttonDisabled: boolean;
}

export interface SchemaDesignerHandle {
  dispose(): void;
}

export function mountSchemaDesigner(
  container: HTMLElement,
  options: SchemaDesignerOptions = {},
): SchemaDesignerHandle {
  let session = createEditorDraftSession(createPbfSimulationSchema());
  const previewState: PreviewUiState = {
    lastAcceptedDraftVersion: session.draftVersion,
    status: "synced",
    message: "Preview starts from the same PBF schema. Edits require explicit handoff.",
  };
  const dom = createDesignerDom();

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const previewButton = target.closest<HTMLButtonElement>("[data-action='request-preview']");
    if (previewButton) {
      event.preventDefault();
      void requestPreviewHandoff();
      return;
    }

    const operationButton = target.closest<HTMLButtonElement>("[data-operation]");
    if (!operationButton) {
      return;
    }

    event.preventDefault();
    const operation = createOperation(operationButton.dataset.operation, session);
    if (!operation) {
      return;
    }

    const result = applyEditorOperation(session, operation);
    session = result.session;
    dom.lastOperation.textContent = result.ok
      ? `Applied ${operation.kind}`
      : `Rejected ${operation.kind}: ${result.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`;
    renderDesigner(dom, session, previewState);
    emitCanvasState();
  };

  const requestPreviewHandoff = async (): Promise<void> => {
    const handoff = requestDraftPreviewHandoff(session);

    if (handoff.status === "blocked") {
      previewState.status = "blocked";
      previewState.message = `Preview handoff blocked: ${handoff.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`;
      renderDesigner(dom, session, previewState);
      emitCanvasState();
      return;
    }

    if (!options.onPreviewHandoff) {
      previewState.status = "failure";
      previewState.message = "Preview handoff failed: no runtime callback is registered.";
      renderDesigner(dom, session, previewState);
      emitCanvasState();
      return;
    }

    previewState.status = "pending";
    previewState.message = `Sending validated draft v${handoff.metadata.draftVersion} to preview runtime...`;
    renderDesigner(dom, session, previewState);
    emitCanvasState();

    try {
      const result = await options.onPreviewHandoff({
        schema: handoff.schema,
        metadata: handoff.metadata,
      });
      if (result.ok) {
        previewState.lastAcceptedDraftVersion = handoff.metadata.draftVersion;
        previewState.status = "success";
        previewState.message = result.message;
      } else {
        previewState.status = "failure";
        previewState.message = result.message;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      previewState.status = "failure";
      previewState.message = `Preview handoff failed: ${message}`;
    }

    renderDesigner(dom, session, previewState);
    emitCanvasState();
  };

  const emitCanvasState = (): void => {
    const gateState = derivePreviewGateState({
      draftVersion: session.draftVersion,
      validationStatus: session.validation.status,
      previewState,
    });
    options.onCanvasStateChange?.({
      schema: session.draft,
      diagnostics: session.validation.diagnostics,
      draftVersion: session.draftVersion,
      activePreviewDraftVersion: previewState.lastAcceptedDraftVersion,
      previewStatus: gateState.status,
      previewMessage: gateState.message,
      previewStale: gateState.status === "stale",
      dirty: session.dirty,
      selectedId: session.selectedId,
    });
  };

  container.replaceChildren(dom.root);
  dom.root.addEventListener("click", onClick);
  renderDesigner(dom, session, previewState);
  emitCanvasState();

  return {
    dispose(): void {
      dom.root.removeEventListener("click", onClick);
    },
  };
}

function createDesignerDom(): DesignerDom {
  const root = document.createElement("section");
  root.className = "schema-designer page";
  root.setAttribute("aria-labelledby", "schema-designer-title");
  root.innerHTML = `
    <section class="designer-hero">
      <p class="hero__body">Editable draft milestone backed by the editor operation contract.</p>
      <h2 class="hero__title" id="schema-designer-title">Schema Designer</h2>
      <p class="hero__body">Start from the existing PBF schema, edit a narrow representative slice, and keep preview/runtime handoff gated by schema validation.</p>
    </section>

    <section class="designer-grid">
      <article class="designer-card designer-card--state">
        <div class="inspector-card__eyebrow">Draft State</div>
        <dl class="designer-kv" data-role="summary"></dl>
        <p class="designer-preview-gate" data-role="preview-gate"></p>
        <button type="button" class="designer-preview-button" data-action="request-preview">Preview current draft</button>
      </article>

      <article class="designer-card designer-card--selection">
        <div class="inspector-card__eyebrow">Selection</div>
        <dl class="designer-kv" data-role="selection"></dl>
        <p class="designer-last-operation" data-role="last-operation">No editor operation applied yet.</p>
      </article>

      <article class="designer-card designer-card--validation">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Validation</div>
            <h3 data-role="validation">Unknown</h3>
          </div>
        </div>
        <ol class="designer-diagnostics" data-role="diagnostics"></ol>
      </article>

      <article class="designer-card designer-card--controls">
        <div class="inspector-card__eyebrow">Editor Operations</div>
        <div class="designer-control-groups">
          <section class="designer-control-group">
            <h3>Scratch Buffer</h3>
            <div class="designer-button-row">
              <button type="button" data-operation="create-buffer">Create</button>
              <button type="button" data-operation="update-buffer">Resize</button>
              <button type="button" data-operation="delete-buffer">Delete</button>
            </div>
          </section>
          <section class="designer-control-group">
            <h3>Scratch Pass</h3>
            <div class="designer-button-row">
              <button type="button" data-operation="create-pass">Create</button>
              <button type="button" data-operation="update-pass">Change dispatch</button>
              <button type="button" data-operation="delete-pass">Delete</button>
            </div>
          </section>
          <section class="designer-control-group">
            <h3>Render Graph Node</h3>
            <div class="designer-button-row">
              <button type="button" data-operation="add-node">Add</button>
              <button type="button" data-operation="update-node">Depend on prologue</button>
              <button type="button" data-operation="remove-node">Remove</button>
            </div>
          </section>
          <section class="designer-control-group">
            <h3>Validation Example</h3>
            <div class="designer-button-row">
              <button type="button" data-operation="break-pass">Point pass at missing pipeline</button>
              <button type="button" data-operation="repair-pass">Repair pass</button>
            </div>
          </section>
        </div>
      </article>

      <article class="designer-card">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Buffers</div>
            <h3>Representative nodes</h3>
          </div>
        </div>
        <div class="designer-entity-list" data-role="buffers"></div>
      </article>

      <article class="designer-card">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Passes</div>
            <h3>Representative nodes</h3>
          </div>
        </div>
        <div class="designer-entity-list" data-role="passes"></div>
      </article>

      <article class="designer-card">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Main Render Graph</div>
            <h3>No canvas or layout persistence</h3>
          </div>
        </div>
        <div class="designer-entity-list" data-role="graph-nodes"></div>
      </article>
    </section>
  `;

  return {
    root,
    summary: queryRequired(root, '[data-role="summary"]'),
    selection: queryRequired(root, '[data-role="selection"]'),
    validation: queryRequired(root, '[data-role="validation"]'),
    diagnostics: queryRequired(root, '[data-role="diagnostics"]'),
    buffers: queryRequired(root, '[data-role="buffers"]'),
    passes: queryRequired(root, '[data-role="passes"]'),
    graphNodes: queryRequired(root, '[data-role="graph-nodes"]'),
    previewGate: queryRequired(root, '[data-role="preview-gate"]'),
    previewButton: queryRequired(root, '[data-action="request-preview"]') as HTMLButtonElement,
    lastOperation: queryRequired(root, '[data-role="last-operation"]'),
  };
}

function createOperation(
  name: string | undefined,
  session: EditorDraftSession,
): EditorOperation | null {
  switch (name) {
    case "create-buffer":
      return {
        kind: "createBuffer",
        name: SCRATCH_BUFFER,
        buffer: {
          name: SCRATCH_BUFFER,
          size: 256,
          usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST | BUFFER_USAGE.COPY_SRC,
          type: "storage",
          contentType: "float32",
          mappable: true,
        },
      };
    case "update-buffer": {
      const size = session.draft.buffers[SCRATCH_BUFFER]?.size === 512 ? 256 : 512;
      return { kind: "updateBuffer", name: SCRATCH_BUFFER, patch: { size } };
    }
    case "delete-buffer":
      return { kind: "deleteBuffer", name: SCRATCH_BUFFER };
    case "create-pass":
      return { kind: "createPass", name: SCRATCH_PASS, pass: createScratchPass(64) };
    case "update-pass": {
      const pass = session.draft.passes[SCRATCH_PASS];
      const dispatch =
        pass?.type === "compute" && Array.isArray(pass.dispatch) && pass.dispatch[0] === 32
          ? 64
          : 32;
      return { kind: "updatePass", name: SCRATCH_PASS, patch: { dispatch: [dispatch, 1, 1] } };
    }
    case "delete-pass":
      return { kind: "deletePass", name: SCRATCH_PASS };
    case "add-node":
      return { kind: "addRenderGraphNode", graphName: MAIN_GRAPH, node: createScratchNode([]) };
    case "update-node": {
      const graph = session.draft.renderGraphs[MAIN_GRAPH];
      const node = graph?.nodes.find((candidate) => candidate.name === SCRATCH_NODE);
      const dependencies = node?.dependencies?.includes("node-prologue") ? [] : ["node-prologue"];
      return {
        kind: "updateRenderGraphNode",
        graphName: MAIN_GRAPH,
        nodeName: SCRATCH_NODE,
        patch: { dependencies },
      };
    }
    case "remove-node":
      return { kind: "removeRenderGraphNode", graphName: MAIN_GRAPH, nodeName: SCRATCH_NODE };
    case "break-pass":
      return { kind: "updatePass", name: SCRATCH_PASS, patch: { pipelineRef: "missing-pipeline" } };
    case "repair-pass":
      return { kind: "updatePass", name: SCRATCH_PASS, patch: { pipelineRef: PIPELINE_REF } };
    default: {
      const selection = parseSelection(name);
      if (!selection) {
        return null;
      }
      return { kind: "selectEntity", id: selection.id, entityType: selection.entityType };
    }
  }
}

function createScratchPass(dispatchX: number): ComputePassSchema {
  return {
    name: SCRATCH_PASS,
    type: "compute",
    pipelineRef: PIPELINE_REF,
    bindGroups: [{ group: 0, bindGroupRef: BIND_GROUP_REF }],
    dispatch: [dispatchX, 1, 1],
  };
}

function createScratchNode(dependencies: string[]): RenderGraphNodeSchema {
  return {
    name: SCRATCH_NODE,
    passRef: SCRATCH_PASS,
    dependencies,
  };
}

function renderDesigner(
  dom: DesignerDom,
  session: EditorDraftSession,
  previewState: PreviewUiState,
): void {
  const inspection = inspectSchema(session.draft);
  renderSummary(dom.summary, session, inspection, previewState);
  renderSelection(dom.selection, session);
  renderValidation(dom, session);
  renderPreviewGate(dom, session, previewState);
  renderEntityList(dom.buffers, inspection, "buffer");
  renderEntityList(dom.passes, inspection, "pass");
  renderGraphNodes(dom.graphNodes, session);
  updateControlAvailability(dom.root, session, previewState);
}

function renderSummary(
  target: HTMLElement,
  session: EditorDraftSession,
  inspection: SchemaInspection,
  previewState: PreviewUiState,
): void {
  const graph = session.draft.renderGraphs[MAIN_GRAPH];
  const activeVersion = previewState.lastAcceptedDraftVersion;
  target.innerHTML = renderRows([
    ["Schema", session.draft.name],
    ["Dirty", session.dirty ? "yes" : "no"],
    ["Draft version", String(session.draftVersion)],
    ["Active preview version", activeVersion === null ? "none" : String(activeVersion)],
    ["Buffers", String(inspection.summary.bufferCount)],
    ["Passes", String(inspection.summary.passCount)],
    ["Graph nodes", String(graph?.nodes.length ?? 0)],
    ["Editor DTO nodes", String(inspection.graph.nodes.length)],
  ]);
}

function renderSelection(target: HTMLElement, session: EditorDraftSession): void {
  target.innerHTML = renderRows([
    ["Selected ID", session.selectedId ?? "none"],
    ["Selected type", session.selectedType ?? "none"],
  ]);
}

function renderValidation(dom: DesignerDom, session: EditorDraftSession): void {
  const valid = session.validation.status === "valid";
  dom.validation.textContent = valid ? "Valid draft" : "Invalid draft";
  dom.validation.className = valid ? "is-valid" : "is-invalid";

  if (session.validation.diagnostics.length === 0) {
    dom.diagnostics.innerHTML = `<li class="designer-diagnostic designer-diagnostic--empty">No diagnostics from the schema validator.</li>`;
    return;
  }

  dom.diagnostics.innerHTML = session.validation.diagnostics
    .map(
      (diagnostic) => `
        <li class="designer-diagnostic">
          <strong>${escapeHtml(diagnostic.rule)}</strong>
          <span>${escapeHtml(diagnostic.message)}</span>
          ${diagnostic.path ? `<code>${escapeHtml(diagnostic.path)}</code>` : ""}
        </li>
      `,
    )
    .join("");
}

function renderPreviewGate(
  dom: DesignerDom,
  session: EditorDraftSession,
  previewState: PreviewUiState,
): void {
  const gateState = derivePreviewGateState({
    draftVersion: session.draftVersion,
    validationStatus: session.validation.status,
    previewState,
  });

  dom.previewGate.textContent = gateState.message;
  dom.previewGate.dataset.state = gateState.status;
  dom.previewGate.classList.toggle(
    "is-blocked",
    gateState.status === "blocked" || gateState.status === "failure",
  );
  dom.previewGate.classList.toggle("is-stale", gateState.status === "stale");
  dom.previewButton.disabled = gateState.buttonDisabled;
}

export function derivePreviewGateState(input: PreviewGateInput): PreviewGateState {
  const { draftVersion, previewState, validationStatus } = input;
  const invalid = validationStatus !== "valid";
  const explicitRuntimeStatus =
    previewState.status === "pending" ||
    previewState.status === "blocked" ||
    previewState.status === "failure";

  if (explicitRuntimeStatus) {
    return {
      status: previewState.status,
      message: previewState.message,
      buttonDisabled: invalid || previewState.status === "pending",
    };
  }

  if (invalid) {
    return {
      status: "blocked",
      message:
        "Preview handoff blocked: invalid drafts are never passed to preview/runtime. See diagnostics.",
      buttonDisabled: true,
    };
  }

  if (
    previewState.lastAcceptedDraftVersion !== null &&
    previewState.lastAcceptedDraftVersion !== draftVersion
  ) {
    return {
      status: "stale",
      message:
        "Preview is stale: edits were made since the last accepted handoff. Use the button to request a validated handoff.",
      buttonDisabled: false,
    };
  }

  return {
    status: previewState.status,
    message: previewState.message,
    buttonDisabled: false,
  };
}

function renderEntityList(
  target: HTMLElement,
  inspection: SchemaInspection,
  entityType: "buffer" | "pass",
): void {
  const nodes = inspection.graph.nodes.filter((node) => node.type === entityType);
  target.innerHTML = nodes
    .map(
      (node) => `
        <button type="button" class="designer-entity" data-operation="select:${entityType}:${escapeHtml(node.id)}">
          <span>${escapeHtml(node.label)}</span>
          <code>${escapeHtml(node.id)}</code>
        </button>
      `,
    )
    .join("");
}

function renderGraphNodes(target: HTMLElement, session: EditorDraftSession): void {
  const graph = session.draft.renderGraphs[MAIN_GRAPH];
  if (!graph) {
    target.textContent = `${MAIN_GRAPH} is missing from the draft.`;
    return;
  }

  target.innerHTML = graph.nodes
    .map((node) => {
      const id = `renderGraphNode:${MAIN_GRAPH}/${node.name}`;
      const targetRef = node.kind === "subgraph" ? node.graphRef : node.passRef;
      return `
        <button type="button" class="designer-entity" data-operation="select:renderGraphNode:${escapeHtml(id)}">
          <span>${escapeHtml(node.name)}</span>
          <code>${escapeHtml(node.kind === "subgraph" ? `subgraph:${targetRef}` : `pass:${targetRef}`)}</code>
        </button>
      `;
    })
    .join("");
}

function updateControlAvailability(
  root: HTMLElement,
  session: EditorDraftSession,
  previewState: PreviewUiState,
): void {
  const hasBuffer = Boolean(session.draft.buffers[SCRATCH_BUFFER]);
  const hasPass = Boolean(session.draft.passes[SCRATCH_PASS]);
  const hasNode = Boolean(
    session.draft.renderGraphs[MAIN_GRAPH]?.nodes.some((node) => node.name === SCRATCH_NODE),
  );
  const availability: Record<string, boolean> = {
    "create-buffer": !hasBuffer,
    "update-buffer": hasBuffer,
    "delete-buffer": hasBuffer,
    "create-pass": !hasPass,
    "update-pass": hasPass,
    "delete-pass": hasPass,
    "add-node": hasPass && !hasNode,
    "update-node": hasNode,
    "remove-node": hasNode,
    "break-pass": hasPass,
    "repair-pass": hasPass,
  };

  for (const [operation, enabled] of Object.entries(availability)) {
    const button = root.querySelector<HTMLButtonElement>(`[data-operation="${operation}"]`);
    if (button) {
      button.disabled = !enabled;
    }
  }

  const previewButton = root.querySelector<HTMLButtonElement>('[data-action="request-preview"]');
  if (previewButton) {
    previewButton.disabled =
      session.validation.status !== "valid" || previewState.status === "pending";
  }
}

function parseSelection(
  value: string | undefined,
): { id: string; entityType: EditorSelectionType } | null {
  if (!value?.startsWith("select:")) {
    return null;
  }

  const [, type, ...idParts] = value.split(":");
  const id = idParts.join(":");
  if ((type !== "buffer" && type !== "pass" && type !== "renderGraphNode") || !id) {
    return null;
  }

  return { id, entityType: type };
}

function renderRows(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value)}</code></dd></div>`,
    )
    .join("");
}

function queryRequired(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Failed to create Schema Designer element: ${selector}`);
  }
  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
