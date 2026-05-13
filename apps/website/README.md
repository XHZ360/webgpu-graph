# website

`website` 是当前仓库的演示入口，用于展示 PBF WebGPU 运行时预览、最小可编辑 Schema Designer 和只读 Schema Graph Inspector。

## 当前页面能力

- PBF demo：通过 `schema/examples/pbf-simulation` 和 `preview` 执行 Compute 优先的模拟闭环
- Schema Designer：通过 `createPbfSimulationSchema()` 和 `editor.createEditorDraftSession()` 创建 draft，展示 selected id/type、dirty、validation status、diagnostics、代表性 counts/nodes，并用 `applyEditorOperation()` 驱动 scratch buffer/pass/render graph node 的 add/edit/delete
- Schema Graph Inspector：通过 `editor.inspectSchema()` 展示 PBF Schema 的 summary、graph nodes / edges 和 selected-node detail

## Inspector 与 Designer 的边界

当前 designer 是只读 inspector 之后的最小可编辑里程碑，不是完整视觉编辑器。`schema` 仍是事实源，`editor` 负责 UI draft/session state 和编辑操作，`preview` 仍是运行时消费层。

它不做以下事情：

- 不拖拽节点或连线
- 不提供完整节点编辑、shader IDE、保存、持久化或导入导出 Schema
- 不要求 WebGPU device、command encoder 或运行中的 preview loop
- 不管理 runtime device，不做 graph canvas、自动布局或 layout persistence
- 不定义 Schema 规则；规则仍以 `schema` 包和 OpenSpec specs 为准

Designer draft 会先通过 schema validator 暴露 diagnostics；当前里程碑不会把 invalid draft 交给 preview，页面只显示被阻断或可用的 preview handoff 状态。

## 开发命令

```bash
vp run website#dev
vp run website#build
vp run website#preview
```
