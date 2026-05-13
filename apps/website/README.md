# website

`website` 是当前仓库的演示入口，用于展示 PBF WebGPU 运行时预览和只读 Schema Graph Inspector。

## 当前页面能力

- PBF demo：通过 `schema/examples/pbf-simulation` 和 `preview` 执行 Compute 优先的模拟闭环
- Schema Graph Inspector：通过 `editor.inspectSchema()` 展示 PBF Schema 的 summary、graph nodes / edges 和 selected-node detail

## Inspector 与 Designer 的边界

当前 inspector 是只读可视化入口，不是完整设计器。它不做以下事情：

- 不拖拽节点或连线
- 不修改、保存或导入导出 Schema
- 不要求 WebGPU device、command encoder 或运行中的 preview loop
- 不定义 Schema 规则；规则仍以 `schema` 包和 OpenSpec specs 为准

后续可编辑 designer 工作应在 inspector 数据契约稳定后再推进，并继续让 `schema` 作为事实源、`editor` 作为 UI 数据层、`preview` 作为运行时消费层。

## 开发命令

```bash
vp run website#dev
vp run website#build
vp run website#preview
```
