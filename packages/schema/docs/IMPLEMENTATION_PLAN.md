# WebGPU Graph 实施与维护

本文档聚焦于实施顺序和阶段判断，不重复 Schema 规格正文。

## 实施顺序

建议按以下顺序推进：

1. 在 `schema` 包内先落地最小可运行的核心类型定义
2. 实现 Builder、Validator 的最小闭环
3. 为 Compute Pipeline + Compute Pass 建立第一条完整执行路径
4. 再扩展 RenderPass、纹理、采样器与更复杂资源类型
5. 最后让 `editor` 与 `preview` 消费同一份正式 Schema

只有 `schema` 包先稳定，编辑器和预览器才不会建立在漂移的数据模型上。

## 当前里程碑

- 仓库结构已建立
- 目标架构已经明确
- 文档规格已具备骨架
- 代码实现仍处于极早期

当前工作重点不是继续扩写概念文档，而是让 `packages/schema` 从最小可运行实现开始，逐步对齐规格文档。

## 当前迁移补充：Route A（运行时 device limits 协商）

在保持当前 Compute 优先闭环不扩散范围的前提下，运行时 capability negotiation 采用以下迁移策略：

1. `schema` 继续作为事实源，提供足以静态推导运行时 limits 的结构
2. `preview` 新增从 Schema 推导 `requiredLimits` 的能力
3. host（如 `website`）继续保留 `GPUAdapter` / `GPUDevice` 请求职责，但不再硬编码某个示例所需的具体 limit
4. 第一阶段只覆盖可静态推导且已出现真实需求的 `maxStorageBuffersPerShaderStage`

这样做的目的不是把 device 生命周期整体迁入 `preview`，而是先把“schema-specific limit knowledge”从 demo 代码上提为 preview 的正式运行时能力。

### 该阶段完成标志

- `preview` 能根据给定 Schema 返回最小 `requiredLimits`
- `website` 使用 `preview` 的推导结果请求 device，而不是写死示例常量
- PBF demo 在支持该 limit 的设备上可继续运行
- 浏览器中不再出现此前由未协商 limit 导致的 WebGPU warning

## 维护建议

1. 根 README 只保留仓库入口信息，链接到拆分后的文档
2. 包级 README 只描述各包职责，不复制完整架构说明
3. 每次落地一个里程碑，补一段"当前已实现"说明
4. 如果代码实现与文档不一致，代码行为代表"已实现状态"，规格文档代表"目标设计"
