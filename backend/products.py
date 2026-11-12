"""从现有产品目录提供完整手册和静态演示。"""

from fastapi import HTTPException

from backend.config import ROOT

PRODUCTS = [
    {
        "id": "crm",
        "slug": "yunxu-crm",
        "name": "云序 CRM",
        "category": "客户关系管理",
        "description": "线索、客户跟进、商机与经营报表。",
    },
    {
        "id": "knowledge",
        "slug": "zhihui-knowledge",
        "name": "知汇企业知识库",
        "category": "企业知识管理",
        "description": "知识沉淀、文档协作与企业信息检索。",
    },
    {
        "id": "contract",
        "slug": "hece-contract",
        "name": "合策合同管理",
        "category": "合同全生命周期管理",
        "description": "合同起草、审批、履约与到期提醒。",
    },
]
TYPES = ["需求沟通与方案介绍", "商务谈判与合作推进", "完整流程练习"]


def product(product_id: str) -> dict:
    """按白名单读取产品，返回全文及静态演示链接。"""
    for item in PRODUCTS:
        if item["id"] == product_id:
            directory = ROOT / "data" / "products" / item["slug"]
            return {
                **item,
                "manual": (directory / "product-manual.md").read_text(),
                "demo_url": f"/products/{item['slug']}/ui-prototype.html",
            }
    raise HTTPException(404, "产品不存在")
