# ai-service/app/main.py
import time
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

start_time = time.time()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Dedicated AI microservice for CampusX: item categorization, pricing recommendations, and visual search.",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "service": "campusx-ai-service",
        "name": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/health")
def health_check():
    """
    Health check endpoint returning service status, uptime, and metadata.
    """
    uptime_seconds = time.time() - start_time
    return {
        "status": "healthy",
        "service": "campusx-ai-service",
        "version": settings.version,
        "environment": settings.env,
        "uptime": round(uptime_seconds, 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": {
            "model_engine": "initialized",
            "fastapi": "healthy"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
