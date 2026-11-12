"""使用 DeepSeek 官方 V4.1 消息编码与 tokenizer 统计完整请求。"""

import hashlib
import json
from functools import lru_cache
from pathlib import Path

from deepseek_recipe import (
    ChatCompletionRequest,
    ConversionOptions,
    DeepseekV41Encoding,
    ModelVersion,
    Tokenizer,
)

from backend.config import ROOT

DEFAULT_TOKENIZER = ROOT / "data" / "tokenizers" / "deepseek-v41" / "tokenizer.json"


@lru_cache(maxsize=4)
def load_tokenizers(path: str):
    """缓存只读官方编码器及纯文本 tokenizer，并记录资源指纹。"""
    raw = Path(path).read_text()
    tokenizer = Tokenizer.from_str(raw)
    plain = json.loads(raw)
    plain["added_tokens"] = []
    return (
        DeepseekV41Encoding().with_tokenizer(tokenizer),
        Tokenizer.from_str(json.dumps(plain, ensure_ascii=False)),
        hashlib.sha256(raw.encode()).hexdigest(),
    )


class TokenCounter:
    """按官方模板编码角色、消息边界和正文，所有计数均来自 token ID。"""

    def __init__(self, path: str, model: str):
        """使用随项目固定的 V4.1 资源或显式配置的同版本本地 tokenizer。"""
        resource = Path(path) if path else DEFAULT_TOKENIZER
        if resource.is_dir():
            resource = resource / "tokenizer.json"
        self.encoding, self.plain, self.fingerprint = load_tokenizers(str(resource.resolve()))
        self.model = model
        self.options = ConversionOptions().with_model_alias(model, ModelVersion.DeepseekV41Flash)

    def text(self, value: str) -> int:
        """计数纯文本 token，将正文中的特殊标记拼写作为普通文字处理。"""
        return len(self.plain.encode(value))

    def messages(self, values: list[dict]) -> int:
        """使用与 API 相同的非思考请求格式编码完整消息及生成前缀。"""
        request = ChatCompletionRequest(
            {"model": self.model, "messages": values, "thinking": {"type": "disabled"}}
        )
        converted = request.convert(self.options)
        return len(self.encoding.encode(converted.conversation))
