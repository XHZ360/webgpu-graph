# WebGPU Graph

`webgpu-graph` 是一个面向 WebGPU 渲染流程的 monorepo，通过声明式 Schema 来建模 GPU 资源、绑定关系、Pipeline、Pass 与 RenderGraph，并在此基础上扩展编辑器与预览能力。

## 文档入口

- `packages/schema/README.md` — Schema 包入口与文档导航
- `packages/schema/docs/PROJECT_OVERVIEW.md` — 项目概览、设计目标、仓库结构
- `packages/schema/docs/SCHEMA_MODEL.md` — 静态数据模型规范
- `packages/schema/docs/SCHEMA_RUNTIME.md` — 运行时与工具链规范
- `packages/schema/docs/IMPLEMENTATION_PLAN.md` — 实施顺序与维护建议

推荐阅读顺序：`PROJECT_OVERVIEW.md` → `SCHEMA_MODEL.md` → `SCHEMA_RUNTIME.md` → `IMPLEMENTATION_PLAN.md`

## 仓库结构

```text
apps/website      项目网站与后续示例入口
packages/schema   Schema 数据模型与工具链
packages/editor   图形化编辑器
packages/preview  运行时预览
```

## 开发命令

```bash
vp install
vp run dev
vp run build -r
vp run test -r
vp check
```
