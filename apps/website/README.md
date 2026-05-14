# website

`website` 是当前仓库的演示入口，用于展示 PBF WebGPU 运行时预览、最小可编辑 Schema Designer、只读 Schema Graph Inspector、只读 Schema Visual Canvas 和 website 触发的模块依赖图。

## 当前页面能力

- PBF demo：通过 `schema/examples/pbf-simulation` 和 `preview` 执行 Compute 优先的模拟闭环
- Schema Designer：通过 `createPbfSimulationSchema()` 和 `editor.createEditorDraftSession()` 创建 draft，展示 selected id/type、dirty、validation status、diagnostics、active preview version、代表性 counts/nodes，并用 `applyEditorOperation()` 驱动 scratch buffer/pass/render graph node 的 add/edit/delete
- Schema Graph Inspector：通过 `editor.inspectSchema()` 展示 PBF Schema 的 summary、graph nodes / edges 和 selected-node detail
- Schema Visual Canvas：紧跟 PBF preview，通过 `editor.createVisualProjection()` 获取 renderer-neutral 投影，再在网站层用 React Flow / XYFlow 映射成只读空间画布，展示 typed nodes、semantic edges、readonly handles、edge filters、adjacency highlight、badges、severity、preview/draft state 和 legend
- Module Dependency Graph：由 website 页面按钮显式触发，构建并展示 `website`、`editor`、`preview`、`schema` 的 workspace module dependency graph

## Inspector 与 Designer 的边界

当前 designer 是只读 inspector 之后的最小可编辑里程碑，不是完整视觉编辑器。`schema` 仍是事实源，`editor` 负责 UI draft/session state 和编辑操作，`preview` 仍是运行时消费层。

它不做以下事情：

- 不拖拽节点或连线
- 不提供完整节点编辑、shader IDE、保存、持久化或导入导出 Schema
- 不要求 WebGPU device、command encoder 或运行中的 preview loop
- 不管理 runtime device，不做 graph canvas、自动布局或 layout persistence
- 不定义 Schema 规则；规则仍以 `schema` 包和 OpenSpec specs 为准

Designer draft 会先通过 schema validator 暴露 diagnostics；invalid draft 会禁用显式 `Preview current draft` handoff 按钮并显示阻断原因，不会把 schema 交给 preview/runtime。valid draft 只在用户点击按钮后调用 `editor.requestDraftPreviewHandoff(session)`，由 `main.ts` 把 cloned、validated schema payload 和 metadata 交给 PBF runtime。

Preview/runtime 仍由 `pbfDemo` 管理 `GPUDevice`、`SimulationRunner`、command encoder 和 RAF loop。runtime 接受 handoff 时会再次校验 schema，并在 `pbfDemo` 内部用已接受 schema 重建 runner 和 schema-specific buffers；Designer 不直接持有或变更运行时资源。

页面状态会区分 active preview schema 与 current draft：初始 PBF schema 为 synced，编辑后显示 stale/dirty，invalid draft 显示 blocked，成功 handoff 显示 accepted。该流程不是 live hot-reload；每次预览都需要显式 handoff。

## Visual Canvas 边界

Visual Canvas 是 Inspector / Designer 之外的只读空间视图。`editor` 包负责从 Schema inspection graph 和 validator diagnostics 派生 `VisualProjection`，其中包含稳定 ID、kind、label、group、source reference、badge、severity、capabilities 和 editability metadata；网站只把该投影映射为 React Flow nodes / edges。

边界要求：

- `schema` 仍是唯一事实源；`VisualProjection` 和 React Flow state 都是派生表示
- React Flow / XYFlow 依赖只存在于 `website`，不会进入 `editor` 的公开投影契约
- 画布可以 pan、zoom、selection、focus 和按边类型过滤；选中节点或边只会高亮一阶邻接关系，不会创建边、重连、删除边、编辑属性或突变 Schema
- 节点位置是临时 renderer state，不保存 layout，也不把拖拽解释为 schema edit
- validation severity、active preview、stale draft 和 readonly 状态只作为 overlay / summary 显示，不要求或持有 `GPUDevice`、command encoder、`SimulationRunner` 或 preview loop

本里程碑显式延后以下能力：完整视觉节点编辑、edge editing、drag layout persistence、property panel、导入导出、shader IDE 和 runtime device lifecycle 管理。

## 开发命令

```bash
vp run website#dev
vp run website#build
vp run website#preview
```
