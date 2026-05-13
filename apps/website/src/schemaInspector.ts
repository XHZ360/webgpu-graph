import { getNodeDetail, inspectSchema, type EditorNode, type SchemaInspection } from "editor";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";
import type { WebGpuSimulationSchema } from "schema";

interface InspectorDom {
  root: HTMLElement;
  nodeList: HTMLElement;
  edgeList: HTMLElement;
  detailPanel: HTMLElement;
  selectedLabel: HTMLElement;
}

export interface SchemaInspectorHandle {
  dispose(): void;
}

export function mountSchemaInspector(container: HTMLElement): SchemaInspectorHandle {
  const schema = createPbfSimulationSchema();
  const inspection = inspectSchema(schema);
  const dom = createInspectorDom(inspection);
  const onNodeClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-node-id]");
    if (!button) {
      return;
    }

    const nodeId = button.dataset.nodeId;
    if (!nodeId) {
      return;
    }

    renderSelectedNode(dom, schema, getNodeDetail, nodeId);
  };

  container.replaceChildren(dom.root);
  dom.nodeList.addEventListener("click", onNodeClick);
  renderSelectedNode(dom, schema, getNodeDetail, `renderGraph:${inspection.summary.mainGraphRef}`);

  return {
    dispose(): void {
      dom.nodeList.removeEventListener("click", onNodeClick);
    },
  };
}

function createInspectorDom(inspection: SchemaInspection): InspectorDom {
  const root = document.createElement("section");
  root.className = "schema-inspector page";
  root.setAttribute("aria-labelledby", "schema-inspector-title");

  root.innerHTML = `
    <section class="inspector-hero">
      <p class="hero__body">Read-only graph contract from the editor inspection layer.</p>
      <h2 class="hero__title" id="schema-inspector-title">Schema Graph Inspector</h2>
      <p class="hero__body">Inspect the PBF schema structure without a GPU device, runtime runner, command encoder, or preview loop.</p>
    </section>

    <section class="inspector-grid">
      <article class="inspector-card inspector-card--summary">
        <div class="inspector-card__eyebrow">Schema Summary</div>
        <dl class="inspector-summary">
          ${renderSummaryRows(inspection)}
        </dl>
      </article>

      <article class="inspector-card inspector-card--nodes">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Graph Nodes</div>
            <h3>Editor DTO nodes</h3>
          </div>
          <span>${inspection.graph.nodes.length} nodes</span>
        </div>
        <div class="inspector-node-list" data-role="node-list"></div>
      </article>

      <article class="inspector-card inspector-card--detail">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Selected Node</div>
            <h3 data-role="selected-label">No node selected</h3>
          </div>
        </div>
        <div class="inspector-detail" data-role="detail-panel"></div>
      </article>

      <article class="inspector-card inspector-card--edges">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Graph Edges</div>
            <h3>Relationships</h3>
          </div>
          <span>${inspection.graph.edges.length} edges</span>
        </div>
        <ol class="inspector-edge-list" data-role="edge-list"></ol>
      </article>
    </section>
  `;

  const nodeList = queryRequired(root, '[data-role="node-list"]');
  const edgeList = queryRequired(root, '[data-role="edge-list"]');
  const detailPanel = queryRequired(root, '[data-role="detail-panel"]');
  const selectedLabel = queryRequired(root, '[data-role="selected-label"]');

  renderNodeButtons(nodeList, inspection.graph.nodes);
  renderEdges(edgeList, inspection);

  return {
    root,
    nodeList,
    edgeList,
    detailPanel,
    selectedLabel,
  };
}

function renderSummaryRows(inspection: SchemaInspection): string {
  const summary = inspection.summary;
  const rows: Array<[string, string]> = [
    ["Name", summary.name],
    ["Version", summary.version],
    ["Buffers", `${summary.bufferCount}`],
    ["Bind group layouts", `${summary.bindGroupLayoutCount}`],
    ["Bind groups", `${summary.bindGroupCount}`],
    ["Shaders", `${summary.shaderCount}`],
    ["Pipelines", `${summary.pipelineCount} (${summary.pipelineTypes.compute} compute)`],
    ["Passes", `${summary.passCount} (${summary.passTypes.compute} compute)`],
    ["Graphs", `${summary.renderGraphCount}`],
    ["Main graph", summary.mainGraphRef],
  ];

  return rows
    .map(
      ([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
}

function renderNodeButtons(target: HTMLElement, nodes: EditorNode[]): void {
  const groups = new Map<EditorNode["type"], EditorNode[]>();
  for (const node of nodes) {
    const group = groups.get(node.type) ?? [];
    group.push(node);
    groups.set(node.type, group);
  }

  const fragment = document.createDocumentFragment();
  for (const [type, groupedNodes] of groups) {
    const groupElement = document.createElement("section");
    groupElement.className = "inspector-node-group";
    groupElement.innerHTML = `<h4>${escapeHtml(formatNodeType(type))}</h4>`;

    for (const node of groupedNodes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inspector-node-button";
      button.dataset.nodeId = node.id;
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `
        <span>${escapeHtml(node.label)}</span>
        <code>${escapeHtml(node.id)}</code>
      `;
      groupElement.append(button);
    }

    fragment.append(groupElement);
  }

  target.replaceChildren(fragment);
}

function renderEdges(target: HTMLElement, inspection: SchemaInspection): void {
  const fragment = document.createDocumentFragment();
  const nodeLabels = new Map(inspection.graph.nodes.map((node) => [node.id, node.label]));

  for (const edge of inspection.graph.edges) {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>${escapeHtml(nodeLabels.get(edge.from) ?? edge.from)}</span>
      <strong>${escapeHtml(edge.label)}</strong>
      <span>${escapeHtml(nodeLabels.get(edge.to) ?? edge.to)}</span>
    `;
    fragment.append(item);
  }

  target.replaceChildren(fragment);
}

function renderSelectedNode(
  dom: InspectorDom,
  schema: WebGpuSimulationSchema,
  getNodeDetailForSchema: typeof getNodeDetail,
  nodeId: string,
): void {
  const detail = getNodeDetailForSchema(schema, nodeId);

  for (const button of dom.nodeList.querySelectorAll<HTMLButtonElement>("[data-node-id]")) {
    const selected = button.dataset.nodeId === nodeId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  if (!detail) {
    dom.selectedLabel.textContent = "Node unavailable";
    dom.detailPanel.textContent = "The editor layer did not return detail for this node.";
    return;
  }

  dom.selectedLabel.textContent = detail.label;
  dom.detailPanel.innerHTML = `
    <dl class="inspector-detail-list">
      <div><dt>ID</dt><dd><code>${escapeHtml(detail.id)}</code></dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(formatNodeType(detail.type))}</dd></div>
      ${Object.entries(detail.properties)
        .map(
          ([key, value]) =>
            `<div><dt>${escapeHtml(formatPropertyName(key))}</dt><dd>${renderPropertyValue(value)}</dd></div>`,
        )
        .join("")}
    </dl>
  `;
}

function renderPropertyValue(value: unknown): string {
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
  }

  return `<code>${escapeHtml(String(value))}</code>`;
}

function queryRequired(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Failed to create Schema Graph Inspector element: ${selector}`);
  }
  return element;
}

function formatNodeType(type: EditorNode["type"]): string {
  return type.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}

function formatPropertyName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
