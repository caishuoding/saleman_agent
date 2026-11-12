# 销售陪练

基于现有侧栏工作台原型实现的本地文字陪练。React 与 TypeScript 前端、FastAPI 后端、两个独立 LangGraph Agent，使用 PostgreSQL 保存训练记录，通过 DeepSeek API 生成客户和教练回复。

## 启动

需要 Python 3.12+、uv、Node.js 22+ 和正在运行的 Docker。

```bash
cp .env.example .env
```

在 `.env` 中填写 `DEEPSEEK_API_KEY`。默认连接本机 `54329` 端口的项目专用 PostgreSQL。

```bash
docker compose up -d --wait db
uv sync --frozen
npm --prefix frontend ci
npm --prefix frontend run build
uv run uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8000
```

浏览器访问 <http://127.0.0.1:8000>。首次启动自动创建首版数据库表。数据库数据保存在 Docker volume，正常停止服务会保留记录。

开发时可在另一个终端运行 `npm --prefix frontend run dev`，访问 Vite 显示的本地地址。Vite 将 `/api` 和 `/products` 代理到后端。

## 训练流程

- 需求沟通与完整流程选择产品后，根据完整产品资料生成并保存本场客户业务背景。准备失败可重新选择同一产品重试。
- 商务谈判选择产品后直接准备练习，客户 Agent 以采购方身份结合本场产品资料讨论合作条件。
- 点击开始确定开始时间，客户聊天与教练交流分别保存。刷新页面通过 URL 恢复原练习。
- 确认结束后，同一个教练以当前上下文直接生成四部分复盘，复盘右侧继续原教练交流。
- 生成失败可原位重试。相同请求标识复用结果，同一场练习的写入由 PostgreSQL 会话锁协调。
- 历史和收藏支持组合筛选与重命名。取消收藏保留历史。续练沿用开始时间，重练复制初始情境并在点击开始时确定新时间。

## Agent 与压缩

客户与教练各有独立图，结构均为 `START → 检查输入 → 按需压缩 → 模型调用 → END`。

每次统计完整输入，以 `(上下文上限 - 输出预留 - 安全余量) × 75%` 触发压缩。将旧摘要和移出窗口的完整问答合并，压缩后优先保留最近六轮，窗口继续追加新消息，达到阈值再压缩。教练分别维护客户参考摘要和自身交流摘要。

固定提示词、客户初始情境、产品资料与复盘独立保留。摘要保存来源、覆盖序号和版本，校验成功后原子提交。原始消息完整保存。内部摘要调用也检查预算并按完整轮次分批处理。

默认模型为 `deepseek-flash`，上下文配置为 1,000,000，采用非思考模式。接入其他版本时调整 `MODEL_CONTEXT_TOKENS`。输出预留可通过 `CUSTOMER_OUTPUT_TOKENS`、`COACH_OUTPUT_TOKENS`、`REVIEW_OUTPUT_TOKENS` 调整，分别默认 2048、4096、8192。

默认使用项目内固定版本的 DeepSeek 官方 V4.1 tokenizer，结合官方 `deepseek-recipe` 消息模板编码完整请求，计入角色、消息边界和生成前缀。`TOKENIZER_PATH` 可覆盖为同版本的本地 tokenizer 文件或目录，资源来源及许可证保存在 `data/tokenizers/deepseek-v41/`。`/api/health` 返回计数方式与 tokenizer 指纹。

每次情境生成、客户回复、教练问答、复盘、摘要和实际重试都保存独立 `model_calls` 记录，包含本地输入 token 数、服务端原始 `usage` 和调用状态。通过 `GET /api/practices/{id}/usage` 查看明细和累计输入、输出、总量。API 返回的 `usage` 是实际消耗依据，缺失统计标为未知；幂等重放沿用原记录。失败调用已收到的统计同样保留，并发请求分别关联所属练习和任务。

## 检查与测试

先启动项目 PostgreSQL，再执行。

```bash
uv run ruff check backend tests
uv run mypy backend
npm --prefix frontend run typecheck
npm --prefix frontend run build
uv run pytest
```

测试经公开 HTTP 接口运行真实图和 PostgreSQL，在临时 schema 中保存数据，结束后清理。模型网络接口使用测试专用的确定性 SSE 服务替代，覆盖生命周期、上下文隔离、压缩、原文保留、游标回滚和重试。真实模型质量与响应时间需要配置有效密钥后验证。

## 资料

完整手册、配图与产品界面来自 `data/products/`，主界面参考根目录 `sales-ui-prototype.html`。本次确认的实现规格保存在 `.scratch/first-release/spec.md`。
