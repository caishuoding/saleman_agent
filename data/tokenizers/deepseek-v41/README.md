# DeepSeek V4.1 tokenizer

来自 DeepSeek 官方 `deepseek-ai/deepseek-recipe` 仓库，固定提交为 `935817c66f5d6e64838f419692545f06787e485f`，路径为 `static/tokenizers/v41/tokenizer.json`。

文件 SHA-256 为 `81f64d1248a68ce3663e07ab3ee48b851e5df0e32d27cb98e4c9a268151e8d99`，与官方来源说明一致。上游说明保存在 `UPSTREAM.md`，MIT 许可证保存在 `LICENSE`。

用于当前 `deepseek-flash` 对应的 V4.1 消息编码。完整消息通过官方 `deepseek-recipe` 的 `DeepseekV41Encoding` 编码，包含角色、消息边界与非思考模式生成前缀。纯文本计数使用相同词表，并将特殊 token 拼写按普通正文处理。

调用前本地计数用于上下文预算。调用后 API 返回的 `usage` 是服务端实际消耗依据，两者分别记录。更换模型版本时，应同步核对 tokenizer 与消息模板。

来源 https://github.com/deepseek-ai/deepseek-recipe/tree/935817c66f5d6e64838f419692545f06787e485f/static/tokenizers/v41
