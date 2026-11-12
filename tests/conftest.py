"""测试仅替换外部模型 HTTP 服务，业务路径与 PostgreSQL 均使用真实实现。"""

import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from backend.app import create_app
from backend.config import Settings


@pytest.fixture
def provider():
    """启动受控 SSE 模型服务并记录网络边界请求，支持一次性故障注入。"""
    state = {
        "requests": [],
        "usages": [],
        "fail_next": False,
        "fail_summary": False,
        "omit_usage": False,
        "finish_reason": "stop",
        "usage_only_frame": False,
        "barrier": None,
    }
    request_lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        """实现测试所需的模型 HTTP 协议，绝不用于应用生产模式。"""

        def log_message(self, *args):
            """静默常规访问日志，避免输出模型请求资料。"""

        def do_POST(self):
            """按真实 HTTP 请求内容生成确定性情境、摘要或回复。"""
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            with request_lock:
                state["requests"].append(body)
                request_number = len(state["requests"])
            messages = body["messages"]
            system = messages[0]["content"]
            summary = "你负责压缩" in system
            if state["fail_next"] or (summary and state["fail_summary"]):
                state["fail_next"] = False
                self.send_response(503)
                self.end_headers()
                return
            if "准备一场" in system:
                result = json.dumps(
                    {
                        "company": "测试企业",
                        "person": "李经理",
                        "role": "业务负责人",
                        "introduction": "负责系统选型。",
                        "private_background": "HIDDEN_NEED 交接漏单",
                        "initial_knowledge": "不了解卖方产品与报价",
                        "opening": "你好，我们可以先聊聊。",
                    },
                    ensure_ascii=False,
                )
            elif summary:
                data = json.loads(messages[-1]["content"].split("\n请严格")[0])
                markers = re.findall(r"轮次\d+", str(data))
                result = json.dumps(
                    {
                        "facts": list(dict.fromkeys(markers)),
                        "proposals": [],
                        "agreements": [],
                        "open_questions": [],
                        "corrections": [],
                        "coaching": [],
                    },
                    ensure_ascii=False,
                )
            elif "本次练习已结束，请" in messages[-1]["content"]:
                result = "## 本次练习的整体表现\n已了解需求。\n## 做得好的地方\n提出开放问题。\n## 最值得改进的地方\n继续追问影响。\n## 下次练习的重点\n确认下一步。"
            elif "训练教练" in system:
                result = "可以追问客户最近一次发生问题的具体情况。"
            else:
                result = "我们主要使用表格，客户交接时有遗漏。"
            if state["barrier"] is not None:
                state["barrier"].wait(timeout=10)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for offset in range(0, len(result), 20):
                chunk = {
                    "choices": [{"delta": {"content": result[offset : offset + 20]}, "finish_reason": None}]
                }
                self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            ending = {"choices": [{"delta": {}, "finish_reason": state["finish_reason"]}]}
            if not state["omit_usage"]:
                usage = {
                    "prompt_tokens": 111 + request_number * 7,
                    "completion_tokens": 13 + request_number,
                    "total_tokens": 124 + request_number * 8,
                    "prompt_cache_hit_tokens": 7,
                    "prompt_cache_miss_tokens": 104 + request_number * 7,
                }
                state["usages"].append(usage)
                if state["usage_only_frame"]:
                    self.wfile.write(("data: " + json.dumps(ending) + "\n\n").encode())
                    ending = {"choices": [], "usage": usage}
                else:
                    ending["usage"] = usage
            self.wfile.write(("data: " + json.dumps(ending) + "\n\ndata: [DONE]\n\n").encode())

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    state["url"] = f"http://127.0.0.1:{server.server_port}"
    yield state
    server.shutdown()
    server.server_close()
    thread.join()


@pytest.fixture
def make_client(provider):
    """为每个测试创建独立 PostgreSQL schema，返回仅通过公开接口操作的客户端。"""
    url = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://sales:sales@127.0.0.1:54329/sales")
    schema = "test_" + uuid4().hex
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    clients = []

    def create(**overrides):
        """构建不同 token 预算的真实应用，各客户端共享本测试数据库。"""
        settings = Settings(
            _env_file=None,
            database_url=url + f"?options=-csearch_path%3D{schema}",
            deepseek_api_key="test-key",
            deepseek_base_url=provider["url"],
            **overrides,
        )
        client = TestClient(create_app(settings))
        client.__enter__()
        clients.append(client)
        return client

    yield create
    for client in reversed(clients):
        client.__exit__(None, None, None)
    with engine.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    engine.dispose()


@pytest.fixture
def client(make_client):
    """提供默认参数的公开 API 测试客户端。"""
    return make_client()
