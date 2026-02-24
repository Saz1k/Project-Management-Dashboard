from fastapi import FastAPI

from app.api.routes import auth, boards, checklist, columns, comments, invitations, labels, tasks

app = FastAPI(title="PM Dashboard", version="1.0.0")

app.include_router(auth.router)
app.include_router(boards.router)
app.include_router(columns.router)
app.include_router(tasks.router)
app.include_router(comments.router)
app.include_router(labels.router)
app.include_router(checklist.router)
app.include_router(invitations.router)
