"""通过公开 HTTP 接口验证练习生命周期，模型服务在网络边界替换。"""

import random

import pytest


def history_text(index: int, size: int = 1600, prefix: str = "") -> str:
    """生成稳定且高信息密度的原文，避免重复字符被真实 tokenizer 大幅合并。"""
    return f"{prefix}轮次{index:02d} " + random.Random(index).randbytes(size).hex()


def test_products_expose_all_three_manuals(client):
    """资料入口提供三个真实产品手册及可用的产品演示地址。"""
    response = client.get("/api/products")
    assert response.status_code == 200
    products = response.json()
    assert {p["id"] for p in products} == {"crm", "knowledge", "contract"}
    manual = client.get("/api/products/crm").json()
    assert "云序" in manual["manual"]
    assert client.get(manual["demo_url"]).status_code == 200


def test_practice_can_chat_review_resume_and_restart(client, provider):
    """从公开入口完成开练、独立教练、复盘、收藏和重练，原记录完整保留。"""
    prepared = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": "prepare-1"}
    )
    assert prepared.status_code == 200
    draft = prepared.json()
    assert draft["started_at"] is None
    assert "private_background" not in draft["scenario"]
    pid = draft["id"]
    started = client.post(f"/api/practices/{pid}/start").json()
    initial_time = started["started_at"]
    assert initial_time
    message = {"agent": "customer", "content": "现在如何管理客户？", "request_id": "message-1"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=message).text
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=message).text
    coach = {"agent": "coach", "content": "教练私聊标记：下一步问什么？", "request_id": "coach-1"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=coach).text
    second = {"agent": "customer", "content": "这个问题造成什么影响？", "request_id": "message-2"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=second).text
    customer_prompt = provider["requests"][-1]["messages"]
    assert "教练私聊标记" not in str(customer_prompt)
    assert "private_background" in str(customer_prompt)
    finish = client.post(f"/api/practices/{pid}/finish", json={"request_id": "finish-1"})
    assert "event: done" in finish.text
    done = client.get(f"/api/practices/{pid}").json()
    assert done["status"] == "done" and done["report_status"] == "complete"
    assert "下次练习" in done["report"]
    assert "教练私聊标记" in str(provider["requests"][-1]["messages"])
    assert "HIDDEN_NEED" not in str(provider["requests"][-1]["messages"])
    coach["request_id"] = "coach-2"
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=coach).text
    assert "下次练习" in str(provider["requests"][-1]["messages"])
    changed = client.patch(f"/api/practices/{pid}", json={"name": "我的练习", "favorite": True}).json()
    assert changed["favorite"] and changed["name"] == "我的练习"
    assert client.get("/api/practices?favorite=true&kind=0&product_id=crm&status=done").json()[0]["id"] == pid
    client.patch(f"/api/practices/{pid}", json={"favorite": False})
    assert client.get(f"/api/practices/{pid}").status_code == 200
    restarted = client.post(f"/api/practices/{pid}/restart", json={"request_id": "restart-1"}).json()
    assert restarted["id"] != pid and restarted["scenario"] == done["scenario"]
    assert restarted["exchanges"] == [] and restarted["memory_status"] == {}
    fresh = client.post(f"/api/practices/{restarted['id']}/start").json()
    assert fresh["started_at"] != initial_time
    assert client.get(f"/api/practices/{pid}").json()["started_at"] == initial_time
    calls = client.get(f"/api/practices/{pid}/usage").json()["calls"]
    assert {call["purpose"] for call in calls} == {"prepare", "customer", "coach", "review"}


def test_failed_message_retries_in_place_before_next_message(client, provider):
    """失败消息必须先原位恢复，后续消息不能越过失败轮次改变聊天顺序。"""
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": "failure-prepare"}
    ).json()
    pid = draft["id"]
    client.post(f"/api/practices/{pid}/start")
    request = {"agent": "customer", "content": "第一条消息", "request_id": "failure-message"}
    provider["fail_next"] = True
    assert "event: error" in client.post(f"/api/practices/{pid}/messages", json=request).text
    later = {"agent": "customer", "content": "下一条消息", "request_id": "later-message"}
    assert "event: error" in client.post(f"/api/practices/{pid}/messages", json=later).text
    failed = client.get(f"/api/practices/{pid}").json()
    assert len(failed["exchanges"]) == 1
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=request).text
    restored = client.get(f"/api/practices/{pid}").json()
    assert len(restored["exchanges"]) == 1 and restored["exchanges"][0]["status"] == "complete"
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=later).text


def test_compression_keeps_all_originals_and_recent_six_rounds(make_client, provider):
    """经过公开消息接口触发压缩，所有原文可恢复，最近六轮仍以原文提供给客户。"""
    client = make_client(
        model_context_tokens=20000,
        compression_threshold=0.65,
        customer_output_tokens=512,
        customer_summary_tokens=1024,
    )
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 2, "request_id": "compress-prepare"}
    ).json()
    pid = draft["id"]
    started = client.post(f"/api/practices/{pid}/start").json()
    for index in range(12):
        payload = {
            "agent": "customer",
            "request_id": f"round-{index}",
            "content": history_text(index),
        }
        response = client.post(f"/api/practices/{pid}/messages", json=payload)
        assert "event: done" in response.text, response.text
    restored = client.get(f"/api/practices/{pid}").json()
    assert len(restored["exchanges"]) == 12
    assert restored["started_at"] == started["started_at"]
    state = restored["memory_status"]["customer"]["customer_dialogue"]
    assert state["covered_until_seq"] > 0 and state["version"] >= 1
    last_prompt = provider["requests"][-1]["messages"]
    for index in range(5, 12):
        assert any(m["content"] == history_text(index) for m in last_prompt)
    assert not any(m["content"] == history_text(0) for m in last_prompt)
    assert "轮次00" in str(last_prompt)
    calls = client.get(f"/api/practices/{pid}/usage").json()["calls"]
    assert any(call["purpose"] == "summary" for call in calls)
    assert all(call["usage"] is not None for call in calls)


def test_failed_summary_keeps_cursor_and_retry_preserves_originals(make_client, provider):
    """摘要服务失败时覆盖游标保持旧值，重试后原始消息数量稳定。"""
    client = make_client(
        model_context_tokens=20000,
        compression_threshold=0.65,
        customer_output_tokens=512,
        customer_summary_tokens=1024,
    )
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": "summary-failure"}
    ).json()
    pid = draft["id"]
    client.post(f"/api/practices/{pid}/start")
    for index in range(10):
        payload = {
            "agent": "customer",
            "request_id": f"stable-{index}",
            "content": history_text(index),
        }
        assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=payload).text
    before = client.get(f"/api/practices/{pid}").json()
    provider["fail_summary"] = True
    payload = {"agent": "customer", "request_id": "retry-summary", "content": history_text(10)}
    assert "event: error" in client.post(f"/api/practices/{pid}/messages", json=payload).text
    after = client.get(f"/api/practices/{pid}").json()
    assert after["memory_status"] == before["memory_status"]
    assert after["exchanges"][-1]["status"] == "failed"
    provider["fail_summary"] = False
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=payload).text
    restored = client.get(f"/api/practices/{pid}").json()
    assert len(restored["exchanges"]) == 11
    assert restored["exchanges"][-1]["status"] == "complete"


def test_coach_compresses_sources_independently_and_reviews_current_context(make_client, provider):
    """教练分别压缩客户参考与自身问答，复盘直接复用这些上下文。"""
    client = make_client(
        model_context_tokens=40000,
        coach_output_tokens=2048,
        customer_summary_tokens=1024,
        coach_summary_tokens=1024,
    )
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 1, "request_id": "coach-compression"}
    ).json()
    pid = draft["id"]
    client.post(f"/api/practices/{pid}/start")
    for index in range(10):
        payload = {
            "agent": "customer",
            "request_id": f"customer-{index}",
            "content": history_text(index, 1200, "客户"),
        }
        assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=payload).text
    for index in range(9):
        payload = {
            "agent": "coach",
            "request_id": f"coach-{index}",
            "content": history_text(index, 3000, "教练"),
        }
        response = client.post(f"/api/practices/{pid}/messages", json=payload)
        assert "event: done" in response.text, response.text
    before = client.get(f"/api/practices/{pid}").json()
    assert "customer" not in before["memory_status"]
    coach_memory = before["memory_status"]["coach"]
    assert coach_memory["customer_reference"]["covered_until_seq"] > 0
    assert coach_memory["coach_dialogue"]["covered_until_seq"] > 0
    response = client.post(f"/api/practices/{pid}/finish", json={"request_id": "compressed-review"})
    assert "event: done" in response.text, response.text
    prompt = provider["requests"][-1]["messages"]
    assert "本次练习已结束，请" in prompt[-1]["content"]
    assert "历史摘要" in str(prompt)
    assert "HIDDEN_NEED" not in str(prompt)
    after = client.get(f"/api/practices/{pid}").json()
    assert len(after["exchanges"]) == 20


def test_practice_starts_empty_and_ignores_generated_opening(client, provider):
    """学员先开口，旧格式生成的 opening 不进入界面和教练上下文。"""
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": "opening-prepare"}
    ).json()
    pid = draft["id"]
    assert "opening" not in draft["scenario"]
    started = client.post(f"/api/practices/{pid}/start").json()
    assert started["exchanges"] == []
    question = {
        "agent": "coach",
        "content": "我还没和客户交流，应该怎样开始？",
        "request_id": "opening-coach",
    }
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=question).text
    assert "你好，我们可以先聊聊。" not in str(provider["requests"][-1]["messages"])
    assert "HIDDEN_NEED" not in str(provider["requests"][-1]["messages"])


def test_customer_identity_and_message_roles_stay_aligned(client, provider):
    """客户系统身份明确，首轮与后续 user/assistant 顺序对应实际学员与客户。"""
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": "identity-prepare"}
    ).json()
    pid = draft["id"]
    client.post(f"/api/practices/{pid}/start")
    first = {
        "agent": "customer",
        "content": "你好 我是我们公司的销售 我想和你介绍一下我们家的产品",
        "request_id": "identity-first",
    }
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=first).text
    initial = provider["requests"][-1]["messages"]
    assert [m["role"] for m in initial] == ["system", "user"]
    assert "你是测试企业的业务负责人李经理" in initial[0]["content"]
    assert "user 消息来自乙方销售学员" in initial[0]["content"]
    assert "opening" not in initial[0]["content"]
    assert "你好，我们可以先聊聊。" not in initial[0]["content"]
    assert initial[1]["content"] == first["content"]
    second = {"agent": "customer", "content": "你们目前怎么管理客户信息？", "request_id": "identity-second"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=second).text
    history = provider["requests"][-1]["messages"]
    assert [m["role"] for m in history] == ["system", "user", "assistant", "user"]
    assert history[1]["content"] == first["content"]
    assert history[2]["content"] == "我们主要使用表格，客户交接时有遗漏。"
    assert history[3]["content"] == second["content"]


@pytest.mark.parametrize("kind", [0, 2])
def test_preparation_checks_budget_before_generating_background(make_client, provider, kind):
    """需求与完整流程的产品资料超出预算时，在生成背景前返回业务错误。"""
    client = make_client(model_context_tokens=10000)
    response = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": kind, "request_id": "small-context"}
    )
    assert response.status_code == 503
    assert "上下文预算" in response.json()["detail"]
    assert provider["requests"] == []


def test_review_failure_can_retry_without_reopening_customer_chat(client, provider):
    """复盘失败保留结束状态，重试同一任务后可继续教练交流。"""
    draft = client.post(
        "/api/practices/prepare", json={"product_id": "crm", "kind": 0, "request_id": "review-failure"}
    ).json()
    pid = draft["id"]
    client.post(f"/api/practices/{pid}/start")
    provider["fail_next"] = True
    body = {"request_id": "finish-failed"}
    assert "event: error" in client.post(f"/api/practices/{pid}/finish", json=body).text
    state = client.get(f"/api/practices/{pid}").json()
    assert state["status"] == "done" and state["report_status"] == "failed"
    message = {"request_id": "ended-customer", "agent": "customer", "content": "再聊一句"}
    assert "本场练习已经结束" in client.post(f"/api/practices/{pid}/messages", json=message).text
    assert "event: done" in client.post(f"/api/practices/{pid}/finish", json=body).text
    state = client.get(f"/api/practices/{pid}").json()
    assert len(state["exchanges"]) == 1 and state["report_status"] == "complete"
