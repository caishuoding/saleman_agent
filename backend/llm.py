"""通过后端调用模型，统一处理流式回复、超时和摘要输出。"""

import json
from collections.abc import AsyncIterator, Callable
from contextlib import contextmanager
from contextvars import ContextVar
from uuid import uuid4

import httpx

from backend.config import Settings
from backend.tokenization import TokenCounter

CALL_SCOPE: ContextVar[dict | None] = ContextVar("model_call_scope", default=None)


class ModelError(Exception):
    """表示可以向界面安全显示的模型调用错误。"""


class DeepSeek:
    """隔离外部模型 HTTP 接口，密钥仅存在后端。"""

    def __init__(self, settings: Settings, record_call: Callable[[dict], None]):
        """绑定独立调用记录回调、官方 tokenizer 及带超时的 HTTP 客户端。"""
        self.settings = settings
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(180, connect=15))
        self.record_call = record_call
        self.counter = TokenCounter(settings.tokenizer_path, settings.deepseek_model)

    async def close(self) -> None:
        """关闭连接池以释放应用生命周期内的网络资源。"""
        await self.client.aclose()

    @contextmanager
    def scope(self, practice_id: str, exchange_seq: int | None, agent: str, purpose: str):
        """为本次异步调用绑定练习与任务，子节点继承作用域且并发互不覆盖。"""
        token = CALL_SCOPE.set(
            {"practice_id": practice_id, "exchange_seq": exchange_seq, "agent": agent, "purpose": purpose}
        )
        try:
            yield
        finally:
            CALL_SCOPE.reset(token)

    async def stream(
        self, messages: list[dict], max_tokens: int, purpose: str | None = None
    ) -> AsyncIterator[str]:
        """逐段生成并保存真实用量，输出截断时读完最终统计后再报告失败。"""
        if not self.settings.deepseek_api_key:
            raise ModelError("请在项目 .env 中配置 DEEPSEEK_API_KEY，再重试。")
        scope = CALL_SCOPE.get() or {}
        call = {
            "id": str(uuid4()),
            "practice_id": scope.get("practice_id"),
            "exchange_seq": scope.get("exchange_seq"),
            "agent": scope.get("agent", "unknown"),
            "purpose": purpose or scope.get("purpose", "unknown"),
            "model": self.settings.deepseek_model,
            "tokenizer_sha256": self.counter.fingerprint,
            "tokenizer_input_tokens": self.counter.messages(messages),
            "usage": None,
            "status": "running",
        }
        self.record_call(call)
        usage = None
        status = "failed"
        try:
            async with self.client.stream(
                "POST",
                self.settings.deepseek_base_url.rstrip("/") + "/chat/completions",
                headers={"Authorization": "Bearer " + self.settings.deepseek_api_key},
                json={
                    "model": self.settings.deepseek_model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "thinking": {"type": "disabled"},
                    "stream": True,
                    "stream_options": {"include_usage": True},
                },
            ) as response:
                if response.status_code != 200:
                    raise ModelError(f"模型服务返回 {response.status_code}，请检查配置后重试。")
                finished = False
                failure: str | None = None
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        if failure:
                            raise ModelError(failure)
                        if not finished:
                            raise ModelError("模型回复未完整结束，请重试。")
                        status = "complete"
                        return
                    payload = json.loads(data)
                    if isinstance(payload.get("usage"), dict):
                        usage = payload["usage"]
                    for choice in payload.get("choices", []):
                        reason = choice.get("finish_reason")
                        if reason == "length":
                            failure = "模型回复达到输出上限，请调整输出预算后重试。"
                            finished = True
                        if reason == "stop":
                            finished = True
                        text = choice.get("delta", {}).get("content")
                        if text:
                            yield text
                if failure:
                    raise ModelError(failure)
                if not finished:
                    raise ModelError("模型连接中断，请重试。")
                status = "complete"
        except (httpx.HTTPError, ValueError) as exc:
            raise ModelError("模型连接失败或返回格式异常，请重试。") from exc
        except BaseException as exc:
            if not isinstance(exc, Exception):
                status = "interrupted"
            raise
        finally:
            self.record_call({**call, "usage": usage, "status": status})

    async def complete(self, messages: list[dict], max_tokens: int, purpose: str | None = None) -> str:
        """收集内部任务正文，保留调用目的并记录每次情境或摘要用量。"""
        chunks = [chunk async for chunk in self.stream(messages, max_tokens, purpose=purpose)]
        text = "".join(chunks).strip()
        if not text:
            raise ModelError("模型返回空内容，请重试。")
        return text
