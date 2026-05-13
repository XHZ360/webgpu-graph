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
- `createEditorDraftSession(schema)`：从现有 Schema 创建可编辑草稿会话，不隐式修改输入对象
- `applyEditorOperation(session, operation)`：通过显式操作更新草稿，并返回新会话或失败诊断
- `requestDraftPreviewHandoff(session)`：显式请求把当前草稿交给 preview/runtime；只有验证通过的草稿会返回克隆后的 Schema payload
- `inspectSchema(schema)`：返回结构摘要、Mermaid 文本和图数据
- `getNodeDetail(schema, nodeId)`：按编辑器节点 ID 返回节点详情
- `EditorState`、`EditorDraftSession`、`EditorOperation`、`EditorOperationResult`、`DraftPreviewHandoffResult`、`EditorNode`、`EditorEdge`、`GraphData`、`SchemaInspection` 等类型

## Inspector 契约

`editor` 当前提供的是只读 Schema Graph Inspector 数据契约：调用方传入 `WebGpuSimulationSchema`，包内复用 `schema/visualization` 生成 summary / Mermaid，并生成稳定的 graph node、edge 与 node detail DTO。

该契约适合网站或后续设计器 UI 消费，但不代表已经具备可编辑设计器能力。首个里程碑只保证：

- 能查看 Schema summary
- 能列出 graph nodes / edges
- 能按节点 ID 查看 buffer、layout、bindGroup、shader、pipeline、pass、renderGraph 详情
- 不修改传入的 Schema
- 不依赖 `GPUDevice`、`SimulationRunner` 或 preview 执行循环

## Minimal Designer Edit Contract

`editor` 现在还提供最小可编辑设计器契约。`schema` 仍是结构和验证规则的来源；`editor` 只负责从现有 `WebGpuSimulationSchema` 创建草稿、维护 UI 可消费状态，并把编辑交给 `DefaultSchemaValidator` 验证。

草稿会话包含：

- `draft`：当前可编辑 Schema 草稿
- `draftVersion`：确定性的草稿版本号，初始为 `0`，每次成功的 mutating operation 递增；selection 不递增
- `selectedId` / `selectedType`：UI 当前选中的实体标识与类型
- `dirty`：草稿是否已被编辑操作修改
- `validation.status` / `validation.diagnostics`：当前草稿验证状态与诊断

编辑必须通过 `EditorOperation`，当前最小范围覆盖：

- Buffer：`createBuffer`、`updateBuffer`、`deleteBuffer`
- Pass：`createPass`、`updatePass`、`deletePass`
- RenderGraph node reference：`addRenderGraphNode`、`updateRenderGraphNode`、`removeRenderGraphNode`
- Selection：`selectEntity`

`applyEditorOperation()` 对支持的操作返回新的 `EditorDraftSession`。不支持的操作、重复创建、缺失目标或歧义重命名会失败并返回 `EDITOR_OPERATION` 诊断，且不会修改传入的旧会话。编辑后的草稿可能处于 `invalid` 状态，调用方应读取 `validation.diagnostics`，preview/runtime 只能消费通过验证的草稿。

## Designer Preview Handoff

Preview handoff 是显式边界：编辑器不会在每次编辑后自动触发运行时，也不会拥有 `GPUDevice`、command encoder、`SimulationRunner` 或 preview loop。设计器 UI 必须在用户请求预览时调用 `requestDraftPreviewHandoff(session)`。

返回结果分为：

- `status: "accepted"`：仅当 `session.validation.status === "valid"` 且克隆后的草稿再次通过 `DefaultSchemaValidator` 时返回；结果包含独立克隆的 `schema`，以及 `draftVersion`、`dirty`、`selectedId`、`selectedType` 元数据，供 UI 判断当前 preview 是否对应最新草稿
- `status: "blocked"`：无 Schema payload；返回验证诊断，preview/runtime 不应消费或执行该草稿

该 API 只传递已验证的声明式 Schema 和 UI 元数据，不引入 GPU/runtime 依赖。preview/runtime 仍负责接收 accepted payload 后创建、重置或销毁运行时资源。

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
- 不通过网站层或预览层直接突变 Schema
- 不持久化布局或保存完整 UI 状态
- 不承诺完整 UI、拖拽编辑、布局算法或持久化编辑流程已经落地
- 不实现完整视觉节点编辑器、shader IDE、自动布局或运行时设备管理

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
