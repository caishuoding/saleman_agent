Status: resolved
Type: task

# 接入官方 tokenizer 与持久化真实用量

依据 ../spec.md，实现调用前精确编码与服务端 usage 记录。

## Comments

- 2026-11-12 用户要求移除保守估算，使用 tokenizer 记录真实 token。

## Answer

- 已使用固定版本的官方 DeepSeek V4.1 tokenizer 与 deepseek-recipe 完整消息编码，移除字节估算；调用前计数包含角色、边界和非思考生成前缀。
- 新增 model_calls 表，独立保存每次情境、业务回复、摘要及实际重试的本地输入计数、服务端原始 usage、状态和 tokenizer 指纹。
- 使用 ContextVar 关联练习与任务，并发请求的统计保持独立。通过 GET /api/practices/{id}/usage 查询明细和真实累计用量，缺失统计明确标记未上报。
- 兼容与结束原因同帧及后续独立终帧中的 usage，截断回复读完统计后报告失败。
- 完整 15 项公开接口测试通过，覆盖精确数值持久化、幂等、并发对应、重启恢复、截断、未知统计和真实 tokenizer 下的压缩。Ruff、mypy 与前端类型检查通过。
- 双轴审查完成，Standards 无发现，Spec 的终帧兼容建议已补充并复查通过。
- 本地服务已重启，健康接口确认 deepseek_v41_tokenizer 与官方资源 SHA。真实 DeepSeek 密钥仍未配置，服务端用量记录机制已通过测试模型 HTTP 服务验证。
