"""保存训练原文与派生摘要，所有业务状态以 PostgreSQL 为准。"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def utcnow() -> datetime:
    """返回带时区的当前时间，用于跨设备一致的开始时间。"""
    return datetime.now(UTC)


class Base(DeclarativeBase):
    """集中注册首版数据库表结构。"""


class Practice(Base):
    """保存一场练习的初始快照、摘要状态及复盘。"""

    __tablename__ = "practices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    preparation_key: Mapped[str] = mapped_column(String(64), unique=True)
    product_id: Mapped[str] = mapped_column(String(30))
    kind: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="draft")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    favorite: Mapped[bool] = mapped_column(default=False)
    scenario: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    manual: Mapped[str] = mapped_column(Text)
    memory: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    report: Mapped[str] = mapped_column(Text, default="")
    report_status: Mapped[str] = mapped_column(String(20), default="idle")
    last_error: Mapped[str] = mapped_column(Text, default="")


class Exchange(Base):
    """一行保存完整问答和幂等标识，失败记录可以原位重试。"""

    __tablename__ = "exchanges"
    __table_args__ = (UniqueConstraint("practice_id", "request_id"),)
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    practice_id: Mapped[str] = mapped_column(ForeignKey("practices.id"), index=True)
    request_id: Mapped[str] = mapped_column(String(64))
    agent: Mapped[str] = mapped_column(String(20))
    input: Mapped[str] = mapped_column(Text)
    output: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def database(url: str):
    """创建 PostgreSQL 连接池及短事务会话工厂。"""
    engine = create_engine(url, pool_pre_ping=True)
    return engine, sessionmaker(engine, expire_on_commit=False)
