# WebGPU Graph 项目概览

本文档描述 `webgpu-graph` 仓库在项目层面的统一信息，包括目标、目录结构、开发方式和当前状态。

## 项目概述

`webgpu-graph` 是一个围绕 WebGPU 渲染流程展开的 monorepo。项目目标不是封装若干 WebGPU API，而是提供一套声明式系统，使以下能力可以通过结构化 Schema 组合出来：

- GPU 资源定义
- 绑定关系建模
- Compute / Render Pipeline 组装
- Pass 执行描述
- RenderGraph 依赖表达
- 编辑器可视化与预览

一句话概括当前设计主张：**先把 `schema` 做成唯一事实源，先打通 Compute 优先的最小闭环，再在稳定模型之上扩展 `editor` 与 `preview`。**

从长期方向看，项目由三个互相配合的层面组成：

- `schema`：数据模型、工厂、校验器、序列化与可视化基础能力
- `editor`：面向用户的图形化编辑体验
- `preview`：将 Schema 驱动为实际的运行时预览

## 仓库结构

```text
webgpu-graph/
├─ apps/
│  └─ website/          项目网站与后续演示入口
├─ packages/
│  ├─ editor/           可视化编辑器
│  ├─ preview/          运行时预览能力
│  └─ schema/           Schema 数据模型与工具链
│     ├─ docs/
│     └─ src/
└─ README.md            仓库入口说明
```

职责划分：

- `schema` — 数据模型、验证、工厂、转换和摘要，不做 UI 与运行时
- `preview` — 将 Schema 翻译为真实 WebGPU 资源与执行流程
- `editor` — 编辑体验，不直接承载 Schema 规则定义
- `website` — 项目介绍、文档导航、示例展示

## 项目目标

项目最终要解决的不是"怎样写一段 WebGPU 代码"，而是"怎样用一组可验证、可复用、可编辑的数据结构描述整条 GPU 流程"：

- 让 GPU 资源创建从硬编码迁移为配置驱动
- 让绑定关系、Pipeline 布局和 Pass 依赖显式化
- 让 RenderGraph 可以被校验、可视化和测试
- 让编辑器和预览共享同一份 Schema 作为事实源
- 让复杂模拟场景具备可组合、可扩展的结构基础

## 当前阶段设计目标

当前最重要的 4 项目标：

1. **先稳定 `schema` 的核心边界** — 数据结构、约束、Builder / Factory 都以 `schema` 为中心；`editor` 和 `preview` 只消费，不反向定义规则
2. **先明确模型层与运行时层的职责分离** — `SCHEMA_MODEL.md` 负责数据模型，`SCHEMA_RUNTIME.md` 负责执行能力
3. **先完成 Compute 优先的最小闭环** — 优先打通 `Buffer → BindGroup → ComputePipeline → ComputePass → RenderGraph` 主路径
4. **先保证文档规格逐步对齐实现** — 不继续扩写抽象概念，让最小实现逐步贴近规格

## 当前阶段非目标

以下内容不属于当前阶段的优先事项：

- 不一次性设计完整 WebGPU 全特性抽象
- 不让 `editor` 或 `preview` 先行定义模型
- 不把目标规格误写为稳定公开 API
- 不回到单文档堆叠全部内容的维护方式

## 当前仓库状态

仓库已建立 monorepo 基础结构，`schema` / `preview` / `editor` 三个包都已有可测试实现，当前重点是让已落地能力持续对齐规格文档，并在此基础上扩展运行时与编辑体验。

`packages/schema/src/index.ts` 当前导出核心 Schema 模型、Builder、Validator、Factory 与示例所需的基础工具。已落地的公开面包括：

- Buffer / Binding / Shader / Pipeline / Pass / RenderGraph / Simulation 类型
- `DefaultSchemaBuilder`
- `DefaultSchemaValidator`
- `DefaultSchemaFactory`
- `schema/examples/pbf-simulation`
- `schema/visualization`

文档中涉及的更完整运行时能力、编辑体验和扩展资源类型仍属于**目标规格**；已经从代码入口导出的内容代表当前已实现状态。约定：`SCHEMA_MODEL.md` 与 `SCHEMA_RUNTIME.md` 定义目标设计，代码实现代表已实现状态。

## 开发与运行

### 环境要求

- Node.js `>= 22.12.0`
- 使用 Vite+ 工具链，不直接调用 `pnpm` / `npm` / `yarn`

### 常用命令

```bash
vp install          # 安装依赖
vp run dev          # 启动开发入口
vp run build -r     # 递归构建
vp run test -r      # 递归执行测试
vp check            # 格式化 + lint + 类型检查
```
