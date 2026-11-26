# ai-service/app/config.py
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    app_name: str = "CampusX AI Microservice"
    version: str = "1.0.0"
    port: int = 8000
    host: str = "0.0.0.0"
    env: str = "development"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:5000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

settings = Settings()
