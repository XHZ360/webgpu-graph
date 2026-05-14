export interface ModuleDependencyNode {
  id: string;
  label: string;
  kind: "app" | "package";
  path: string;
}

export interface ModuleDependencyEdge {
  from: string;
  to: string;
  label: string;
}

export interface ModuleDependencyGraph {
  nodes: ModuleDependencyNode[];
  edges: ModuleDependencyEdge[];
}

export interface ModuleDependencyGraphHandle {
  dispose(): void;
}

const WORKSPACE_MODULES: ModuleDependencyNode[] = [
  { id: "website", label: "website", kind: "app", path: "apps/website" },
  { id: "editor", label: "editor", kind: "package", path: "packages/editor" },
  { id: "preview", label: "preview", kind: "package", path: "packages/preview" },
  { id: "schema", label: "schema", kind: "package", path: "packages/schema" },
];

const WORKSPACE_DEPENDENCIES: ModuleDependencyEdge[] = [
  { from: "website", to: "editor", label: "workspace dependency" },
  { from: "website", to: "preview", label: "workspace dependency" },
  { from: "website", to: "schema", label: "workspace dependency" },
  { from: "editor", to: "schema", label: "workspace dependency" },
  { from: "preview", to: "schema", label: "workspace dependency" },
];

export function buildModuleDependencyGraph(): ModuleDependencyGraph {
  return {
    nodes: WORKSPACE_MODULES.map((node) => ({ ...node })),
    edges: WORKSPACE_DEPENDENCIES.map((edge) => ({ ...edge })),
  };
}

export function mountModuleDependencyGraph(container: HTMLElement): ModuleDependencyGraphHandle {
  const root = createModuleDependencyGraphDom();
  const trigger = queryRequired<HTMLButtonElement>(root, '[data-action="build-module-graph"]');
  const summary = queryRequired(root, '[data-role="module-graph-summary"]');
  const nodeList = queryRequired(root, '[data-role="module-graph-nodes"]');
  const edgeList = queryRequired(root, '[data-role="module-graph-edges"]');

  const onBuild = (): void => {
    const graph = buildModuleDependencyGraph();
    renderModuleDependencyGraph(graph, summary, nodeList, edgeList);
    trigger.textContent = "Rebuild module dependency graph";
  };

  trigger.addEventListener("click", onBuild);
  container.replaceChildren(root);

  return {
    dispose(): void {
      trigger.removeEventListener("click", onBuild);
    },
  };
}

function createModuleDependencyGraphDom(): HTMLElement {
  const root = document.createElement("section");
  root.className = "module-graph page";
  root.setAttribute("aria-labelledby", "module-graph-title");
  root.innerHTML = `
    <section class="module-graph__hero">
      <p class="hero__body">Website-triggered workspace dependency projection.</p>
      <h2 class="hero__title" id="module-graph-title">Module Dependency Graph</h2>
      <p class="hero__body">Build a read-only graph of the website app and the internal packages it depends on.</p>
    </section>

    <section class="module-graph__layout">
      <article class="module-graph__card module-graph__card--trigger">
        <div class="inspector-card__eyebrow">Trigger</div>
        <p class="module-graph__summary" data-role="module-graph-summary">Graph has not been built yet.</p>
        <button type="button" class="module-graph__button" data-action="build-module-graph">Build module dependency graph</button>
      </article>

      <article class="module-graph__card">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Modules</div>
            <h3>Workspace nodes</h3>
          </div>
        </div>
        <div class="module-graph__nodes" data-role="module-graph-nodes"></div>
      </article>

      <article class="module-graph__card module-graph__card--edges">
        <div class="inspector-card__head">
          <div>
            <div class="inspector-card__eyebrow">Dependencies</div>
            <h3>Directed edges</h3>
          </div>
        </div>
        <ol class="module-graph__edges" data-role="module-graph-edges"></ol>
      </article>
    </section>
  `;

  return root;
}

function renderModuleDependencyGraph(
  graph: ModuleDependencyGraph,
  summary: HTMLElement,
  nodeList: HTMLElement,
  edgeList: HTMLElement,
): void {
  summary.textContent = `${graph.nodes.length} modules and ${graph.edges.length} dependencies built from website trigger.`;
  nodeList.replaceChildren(...graph.nodes.map(renderModuleNode));
  edgeList.replaceChildren(...graph.edges.map((edge) => renderModuleEdge(edge, graph.nodes)));
}

function renderModuleNode(node: ModuleDependencyNode): HTMLElement {
  const element = document.createElement("article");
  element.className = `module-graph__node module-graph__node--${node.kind}`;
  element.innerHTML = `
    <strong>${escapeHtml(node.label)}</strong>
    <span>${escapeHtml(node.kind)}</span>
    <code>${escapeHtml(node.path)}</code>
  `;
  return element;
}

function renderModuleEdge(edge: ModuleDependencyEdge, nodes: ModuleDependencyNode[]): HTMLElement {
  const labels = new Map(nodes.map((node) => [node.id, node.label]));
  const element = document.createElement("li");
  element.innerHTML = `
    <span>${escapeHtml(labels.get(edge.from) ?? edge.from)}</span>
    <strong>${escapeHtml(edge.label)}</strong>
    <span>${escapeHtml(labels.get(edge.to) ?? edge.to)}</span>
  `;
  return element;
}

function queryRequired<T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Failed to create Module Dependency Graph element: ${selector}`);
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
