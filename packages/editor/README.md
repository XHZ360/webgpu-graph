# editor

`editor` 包负责把 `schema` 中的声明式模拟结构转换为编辑器可消费的 inspection 数据。它当前不是完整图形化编辑器 UI，而是编辑器能力的基础数据层。

## 包职责

- 消费 `schema` 包导出的 `WebGpuSimulationSchema`
- 生成结构摘要与 Mermaid 依赖图
- 将 Schema 转换为编辑器图数据：节点、边和节点详情
- 维护最小编辑器状态，例如当前选中节点

## 当前公开能力

当前包入口 `src/index.ts` 导出以下能力：

- `createEditorState()`：创建基础编辑器状态
- `inspectSchema(schema)`：返回结构摘要、Mermaid 文本和图数据
- `getNodeDetail(schema, nodeId)`：按编辑器节点 ID 返回节点详情
- `EditorState`、`EditorNode`、`EditorEdge`、`GraphData`、`SchemaInspection` 等类型

## Inspector 契约

`editor` 当前提供的是只读 Schema Graph Inspector 数据契约：调用方传入 `WebGpuSimulationSchema`，包内复用 `schema/visualization` 生成 summary / Mermaid，并生成稳定的 graph node、edge 与 node detail DTO。

该契约适合网站或后续设计器 UI 消费，但不代表已经具备可编辑设计器能力。首个里程碑只保证：

- 能查看 Schema summary
- 能列出 graph nodes / edges
- 能按节点 ID 查看 buffer、layout、bindGroup、shader、pipeline、pass、renderGraph 详情
- 不修改传入的 Schema
- 不依赖 `GPUDevice`、`SimulationRunner` 或 preview 执行循环

图数据当前覆盖以下 Schema 节点类型：

- Buffer
- BindGroupLayout
- BindGroup
- Shader
- Pipeline
- Pass
- RenderGraph

## 与 schema 的关系

`editor` 只消费 Schema，不定义 Schema 规则。模型约束、字段含义和验证规则以 `schema` 包和相关规范文档为准：

- `../schema/docs/PROJECT_OVERVIEW.md`
- `../schema/docs/SCHEMA_MODEL.md`
- `../schema/docs/SCHEMA_RUNTIME.md`
- `../../openspec/specs/project-architecture/spec.md`
- `../../openspec/specs/schema-model/spec.md`
- `../../openspec/specs/schema-runtime/spec.md`

## 当前非目标

- 不直接创建或执行 WebGPU 资源
- 不承载运行时 preview 逻辑
- 不在 editor 包内重新定义 Schema 字段规则
- 不在 inspector 阶段写入 Schema、持久化布局或保存 UI 状态
- 不承诺完整 UI、拖拽编辑、布局算法或持久化编辑流程已经落地

## 开发命令

```bash
vp run editor#dev
vp run editor#test
vp run editor#build
vp run editor#check
```

仓库级检查可使用：

```bash
vp check
vp run test -r
vp run build -r
```
