import asyncio
import os

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, boards, checklist, columns, comments, invitations, labels, tasks

app = FastAPI(title="PM Dashboard", version="1.0.0")


async def _self_ping() -> None:
    url = os.getenv("RENDER_EXTERNAL_URL")
    if not url:
        return
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(4 * 60)
            try:
                await client.get(f"{url}/health", timeout=10)
            except Exception:
                pass


@app.on_event("startup")
async def startup() -> None:
    asyncio.create_task(_self_ping())


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(columns.router)
app.include_router(tasks.router)
app.include_router(comments.router)
app.include_router(labels.router)
app.include_router(checklist.router)
app.include_router(invitations.router)
