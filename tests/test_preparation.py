"""通过公开练习接口和模型网络边界验证不同专项的客户上下文。"""

import pytest


@pytest.mark.parametrize("kind", [0, 2])
@pytest.mark.parametrize("product_id", ["crm", "knowledge", "contract"])
def test_background_uses_full_product_and_stays_in_customer_context(client, provider, kind, product_id):
    """需求与完整流程以完整产品资料生成背景，公开信息与客户隐藏需求保持隔离。"""
    product = client.get(f"/api/products/{product_id}").json()
    body = {"product_id": product_id, "kind": kind, "request_id": "background-prepare"}
    response = client.post("/api/practices/prepare", json=body)
    assert response.status_code == 200, response.text
    draft = response.json()
    pid = draft["id"]
    preparation = provider["requests"][0]["messages"]
    assert product["manual"] in preparation[-1]["content"]
    assert product["name"] in preparation[-1]["content"]
    assert "真实可信" in preparation[0]["content"]
    assert "你是客户 Agent" not in preparation[0]["content"]
    assert "initial_knowledge" not in preparation[0]["content"]
    assert "练习起点" not in preparation[-1]["content"]
    assert "HIDDEN_NEED" not in str(draft)
    assert client.post("/api/practices/prepare", json=body).json()["id"] == pid
    assert len(provider["requests"]) == 1
    assert client.post(f"/api/practices/{pid}/start").json()["exchanges"] == []
    first = {"agent": "customer", "content": "你们目前如何管理业务？", "request_id": "discovery"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=first).text
    customer_system = provider["requests"][-1]["messages"][0]["content"]
    assert "测试企业" in customer_system
    assert "HIDDEN_NEED" in customer_system
    assert "initial_knowledge" not in customer_system
    assert product["manual"] not in customer_system
    second = {"agent": "customer", "content": "我们来讨论付款和交付安排。", "request_id": "negotiate"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=second).text
    messages = provider["requests"][-1]["messages"]
    assert messages[0]["content"] == customer_system
    assert messages[1]["content"] == first["content"]
    assert messages[-1]["content"] == second["content"]
    assert len(client.get(f"/api/practices/{pid}").json()["exchanges"]) == 2


@pytest.mark.parametrize("product_id", ["crm", "knowledge", "contract"])
def test_business_prepares_without_model_and_customer_receives_manual(client, provider, product_id):
    """商务准备无需模型，重试复用练习，正式客户请求获得完整产品资料。"""
    manual = client.get(f"/api/products/{product_id}").json()["manual"]
    body = {"product_id": product_id, "kind": 1, "request_id": "business-prepare"}
    provider["fail_next"] = True
    response = client.post("/api/practices/prepare", json=body)
    assert response.status_code == 200, response.text
    draft = response.json()
    pid = draft["id"]
    assert draft["scenario"]["person"] == "采购负责人"
    assert draft["started_at"] is None
    assert draft["exchanges"] == []
    assert provider["requests"] == []
    assert client.get(f"/api/practices/{pid}/usage").json()["calls"] == []
    assert client.post("/api/practices/prepare", json=body).json()["id"] == pid
    assert client.post(f"/api/practices/{pid}/start").json()["exchanges"] == []
    provider["fail_next"] = False
    message = {"agent": "customer", "content": "请问你们对付款条件有什么要求？", "request_id": "terms"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=message).text
    messages = provider["requests"][-1]["messages"]
    assert manual in messages[0]["content"]
    assert "采购方" in messages[0]["content"]
    assert "assistant 消息始终是客户本人" in messages[0]["content"]
    assert [item["role"] for item in messages] == ["system", "user"]
    assert messages[-1]["content"] == message["content"]
    assert [call["purpose"] for call in client.get(f"/api/practices/{pid}/usage").json()["calls"]] == [
        "customer"
    ]


@pytest.mark.parametrize("kind", [0, 2])
def test_failed_background_retries_in_same_practice(client, provider, kind):
    """背景生成失败后使用原请求重试，恢复后重复请求沿用同一背景和调用记录。"""
    body = {"product_id": "crm", "kind": kind, "request_id": "retry-background"}
    provider["fail_next"] = True
    assert client.post("/api/practices/prepare", json=body).status_code == 503
    response = client.post("/api/practices/prepare", json=body)
    assert response.status_code == 200, response.text
    draft = response.json()
    assert draft["last_error"] == ""
    assert client.post("/api/practices/prepare", json=body).json() == draft
    calls = client.get(f"/api/practices/{draft['id']}/usage").json()["calls"]
    assert [call["status"] for call in calls] == ["failed", "complete"]
    assert all(call["purpose"] == "prepare" for call in calls)
    assert len(provider["requests"]) == 2


@pytest.mark.parametrize("kind", [0, 1, 2])
def test_prepared_context_survives_reload_and_restart(make_client, provider, kind):
    """重新加载应用可续练，重练复制初始上下文且不继承旧对话或再次生成背景。"""
    client = make_client()
    body = {"product_id": "contract", "kind": kind, "request_id": "persistent-context"}
    draft = client.post("/api/practices/prepare", json=body).json()
    pid = draft["id"]
    started = client.post(f"/api/practices/{pid}/start").json()
    message = {"agent": "customer", "content": "旧场次的合作安排", "request_id": "before-reload"}
    assert "event: done" in client.post(f"/api/practices/{pid}/messages", json=message).text
    system = provider["requests"][-1]["messages"][0]["content"]
    reloaded = make_client()
    restored = reloaded.get(f"/api/practices/{pid}").json()
    assert restored["scenario"] == draft["scenario"]
    assert restored["started_at"] == started["started_at"]
    assert restored["exchanges"][0]["input"] == message["content"]
    count = len(provider["requests"])
    restart = {"request_id": "restart-context"}
    restarted = reloaded.post(f"/api/practices/{pid}/restart", json=restart).json()
    assert restarted["id"] != pid
    assert restarted["scenario"] == draft["scenario"]
    assert restarted["exchanges"] == []
    assert len(provider["requests"]) == count
    assert reloaded.post(f"/api/practices/{pid}/restart", json=restart).json()["id"] == restarted["id"]
    assert reloaded.post("/api/practices/prepare", json=body).json()["id"] == pid
    reloaded.post(f"/api/practices/{restarted['id']}/start")
    message = {"agent": "customer", "content": "新场次的付款条件", "request_id": "after-restart"}
    assert "event: done" in reloaded.post(f"/api/practices/{restarted['id']}/messages", json=message).text
    messages = provider["requests"][-1]["messages"]
    assert messages[0]["content"] == system
    assert [item["role"] for item in messages] == ["system", "user"]
    assert "旧场次的合作安排" not in str(messages)


def test_preparation_key_rejects_a_different_product_or_kind(client, provider):
    """准备请求标识被复用到其他产品或专项时返回冲突，避免串用客户上下文。"""
    body = {"product_id": "crm", "kind": 1, "request_id": "same-context"}
    assert client.post("/api/practices/prepare", json=body).status_code == 200
    for changed in [{**body, "product_id": "knowledge"}, {**body, "kind": 0}]:
        assert client.post("/api/practices/prepare", json=changed).status_code == 409
    assert provider["requests"] == []
