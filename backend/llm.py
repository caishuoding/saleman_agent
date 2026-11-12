"""通过后端调用模型，统一处理流式回复、超时和摘要输出。"""

import json
from collections.abc import AsyncIterator

import httpx

from backend.config import Settings


class ModelError(Exception):
    """表示可以向界面安全显示的模型调用错误。"""


class DeepSeek:
    """隔离外部模型 HTTP 接口，密钥仅存在后端。"""

    def __init__(self, settings: Settings):
        """记录连接参数并创建有明确超时的异步 HTTP 客户端。"""
        self.settings = settings
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(180, connect=15))
        self.last_usage: dict = {}

    async def close(self) -> None:
        """关闭连接池以释放应用生命周期内的网络资源。"""
        await self.client.aclose()

    async def stream(self, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
        """逐段生成正文，仅传播脱敏错误，完成时记录服务端 token 用量。"""
        if not self.settings.deepseek_api_key:
            raise ModelError("请在项目 .env 中配置 DEEPSEEK_API_KEY，再重试。")
        self.last_usage = {}
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
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        if not finished:
                            raise ModelError("模型回复未完整结束，请重试。")
                        return
                    payload = json.loads(data)
                    if payload.get("usage"):
                        self.last_usage = payload["usage"]
                    for choice in payload.get("choices", []):
                        reason = choice.get("finish_reason")
                        if reason == "length":
                            raise ModelError("模型回复达到输出上限，请调整输出预算后重试。")
                        if reason == "stop":
                            finished = True
                        text = choice.get("delta", {}).get("content")
                        if text:
                            yield text
                if not finished:
                    raise ModelError("模型连接中断，请重试。")
        except (httpx.HTTPError, ValueError) as exc:
            raise ModelError("模型连接失败或返回格式异常，请重试。") from exc

    async def complete(self, messages: list[dict], max_tokens: int) -> str:
        """收集内部情境和摘要调用，不把内部材料发送到浏览器。"""
        chunks = [chunk async for chunk in self.stream(messages, max_tokens)]
        text = "".join(chunks).strip()
        if not text:
            raise ModelError("模型返回空内容，请重试。")
        return text
