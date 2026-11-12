"""加载仅由后端使用的数据库、模型和上下文预算配置。"""

from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """定义可通过环境变量调整的运行参数，默认连接本地 PostgreSQL。"""

    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://sales:sales@127.0.0.1:54329/sales"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-flash"
    model_context_tokens: int = Field(default=1_000_000, ge=1024)
    compression_threshold: float = Field(default=0.75, gt=0, lt=1)
    compression_target: float = Field(default=0.5, gt=0, lt=1)
    keep_rounds: int = Field(default=6, ge=1)
    window_tokens: int = Field(default=12_000, ge=128)
    customer_summary_tokens: int = Field(default=4000, ge=128)
    coach_summary_tokens: int = Field(default=3000, ge=128)
    customer_output_tokens: int = Field(default=2048, ge=64)
    coach_output_tokens: int = Field(default=4096, ge=64)
    review_output_tokens: int = Field(default=8192, ge=64)
    tokenizer_path: str = ""

    @model_validator(mode="after")
    def validate_budget(self) -> "Settings":
        """确保压缩后的目标低于触发阈值，避免反复触发。"""
        if self.compression_target >= self.compression_threshold:
            raise ValueError("COMPRESSION_TARGET 必须小于 COMPRESSION_THRESHOLD")
        return self
