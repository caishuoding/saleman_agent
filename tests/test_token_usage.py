"""经公开 HTTP 接口验证 tokenizer 计数及服务端真实用量的持久化。"""

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest


def prepare(client, key):
    """经正式入口准备并开始一场独立练习。"""
    response = client.post("/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": key})
    assert response.status_code == 200, response.text
    pid = response.json()["id"]
    client.post(f"/api/practices/{pid}/start")
    return pid


def test_api_records_tokenizer_input_and_exact_server_usage(client):
    """情境与回复分别记录服务端用量，重复请求复用结果和原用量。"""
    assert client.get("/api/health").json()["token_counting"] == "deepseek_v41_tokenizer"
    pid = prepare(client, "usage-prepare")
    request = {"agent": "customer", "content": "你好，请介绍一下业务情况。", "request_id": "usage-message"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=request).text
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=request).text
    response = client.get(f"/api/practices/{pid}/usage")
    assert response.status_code == 200
    data = response.json()
    assert len(data["calls"]) == 2
    assert data["totals"] == {
        "prompt_tokens": 243,
        "completion_tokens": 29,
        "total_tokens": 272,
        "reported_calls": 2,
        "unreported_calls": 0,
    }
    assert data["calls"][0]["purpose"] == "prepare"
    assert data["calls"][1]["purpose"] == "customer"
    assert data["calls"][1]["usage"]["prompt_cache_hit_tokens"] == 7
    assert all(call["tokenizer_input_tokens"] > 0 for call in data["calls"])
    assert data["calls"][1]["tokenizer_input_tokens"] != 125


def test_missing_usage_is_unknown_and_failed_retry_has_own_record(client, provider):
    """缺失 usage 不伪造实际数值，失败与重试分别保存独立调用。"""
    pid = prepare(client, "missing-usage")
    request = {"agent": "customer", "content": "请说说现状", "request_id": "missing-message"}
    provider["fail_next"] = True
    assert "event: error" in client.post(f"/api/practices/{pid}/messages", json=request).text
    provider["omit_usage"] = True
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=request).text
    data = client.get(f"/api/practices/{pid}/usage").json()
    assert len(data["calls"]) == 3
    assert data["calls"][1]["status"] == "failed"
    assert data["calls"][1]["usage"] is None
    assert data["calls"][2]["usage"] is None
    assert data["totals"]["reported_calls"] == 1
    assert data["totals"]["unreported_calls"] == 2


@pytest.mark.parametrize("usage_only_frame", [False, True])
def test_length_failure_preserves_received_usage(client, provider, usage_only_frame):
    """输出达到上限时，兼容同帧及随后独立终帧上报的实际用量。"""
    pid = prepare(client, "length-usage")
    provider["finish_reason"] = "length"
    provider["usage_only_frame"] = usage_only_frame
    request = {"agent": "customer", "content": "说说你们的情况", "request_id": "length-message"}
    assert "event: error" in client.post(f"/api/practices/{pid}/messages", json=request).text
    data = client.get(f"/api/practices/{pid}/usage").json()
    assert data["calls"][-1]["status"] == "failed"
    assert data["calls"][-1]["usage"]["total_tokens"] == 140


def test_concurrent_practices_keep_usage_separate(client, provider):
    """不同练习并发调用模型时，调用作用域和真实用量保持正确关联。"""
    first = prepare(client, "concurrent-first")
    second = prepare(client, "concurrent-second")
    provider["barrier"] = threading.Barrier(2)

    def send(pid):
        """从公开接口并发发送独立练习消息。"""
        request = {"agent": "customer", "content": f"关联练习 {pid}", "request_id": "same-request-id"}
        return client.post(f"/api/practices/{pid}/messages", json=request).text

    with ThreadPoolExecutor(max_workers=2) as pool:
        answers = list(pool.map(send, [first, second]))
    assert all("event: done" in answer for answer in answers)
    first_calls = client.get(f"/api/practices/{first}/usage").json()["calls"]
    second_calls = client.get(f"/api/practices/{second}/usage").json()["calls"]
    assert len(first_calls) == len(second_calls) == 2
    assert {first_calls[-1]["usage"]["prompt_tokens"], second_calls[-1]["usage"]["prompt_tokens"]} == {
        132,
        139,
    }
    assert first_calls[-1]["id"] != second_calls[-1]["id"]
    for pid, calls in [(first, first_calls), (second, second_calls)]:
        matching = [
            index
            for index, request in enumerate(provider["requests"], start=1)
            if request["messages"][-1]["content"] == f"关联练习 {pid}"
        ]
        assert len(matching) == 1
        assert calls[-1]["usage"]["prompt_tokens"] == 111 + matching[0] * 7


def test_usage_remains_available_after_app_reload(make_client):
    """重新构建应用后仍从 PostgreSQL 读取同一份服务端用量。"""
    first = make_client()
    pid = prepare(first, "persistent-usage")
    before = first.get(f"/api/practices/{pid}/usage").json()
    second = make_client()
    assert second.get(f"/api/practices/{pid}/usage").json() == before
