# Project Management Dashboard

A Trello-style project management web application that lets teams organize work across boards, columns, and tasks — with real-time collaboration, role-based access control, and cross-board task tracking.

## Problem Statement

Team members working across multiple projects struggle to track what they personally need to do. Generic tools either lack fine-grained access control or don't surface individual workload across boards. This dashboard solves both: it provides a clean Kanban interface with per-board membership control, task assignment, and a unified "My Tasks" view across all boards.

## Features

- **Boards & Columns** — create boards, invite members, organize work into custom columns
- **Tasks** — create tasks with title, description, priority, due date, assignee, and labels
- **My Tasks** — cross-board view of all tasks assigned to the current user, grouped by board
- **Checklist** — per-task checklist items; only the task assignee or board owner can check them off (ABAC)
- **Comments** — threaded comments on tasks
- **Labels** — color-coded labels per board, attachable to tasks
- **Board Analytics** — column load, assignee workload, priority breakdown, and deadline stats
- **Filter bar** — filter tasks by assignee, priority, label, and due date within a board
- **Board invitations** — invite registered users to a board by searching name or email

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, async SQLAlchemy 2, asyncpg |
| Database | PostgreSQL (Render managed) |
| Migrations | Alembic (async, runs on container start) |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Frontend | React 19, TypeScript, Vite |
| Reverse proxy | nginx (serves built frontend + proxies API) |
| Deployment | Render (backend + DB + static frontend) |
| Containerization | Docker, docker-compose |

## Architecture

```
frontend/          React 19 + TypeScript SPA (single App.tsx component)
backend/
  app/
    api/routes/    HTTP layer — auth, boards, columns, tasks, comments,
                   labels, checklist, invitations
    services/      Business logic + DB queries (async SQLAlchemy)
    models/        SQLAlchemy ORM models
    schemas/       Pydantic request/response schemas
    core/          Config, JWT, password hashing, email
  alembic/         Database migrations
```

**Access control pattern:** Board access is gated by ownership or an explicit `board_members` row. Nested resources (columns, tasks, comments, checklist) walk up to the board and call `is_accessible()`. Checklist editing is further restricted to the task assignee or board owner (ABAC).

**Async everywhere:** All DB calls use `AsyncSession` + `asyncpg`. Relationships are eager-loaded with `selectinload`; rows are re-queried after every `commit()` to return fully hydrated objects.

## Running Locally

**Backend** (requires PostgreSQL at `DATABASE_URL`):
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # Vite dev server on :5173, proxies API to :8000
```

**Full stack with Docker:**
```bash
docker-compose up --build   # Postgres + backend + nginx frontend on :3000
```

## Deployment

Deployed on **Render** using three services:
- PostgreSQL managed database
- Backend web service (Docker) — runs `alembic upgrade head` then `uvicorn` on startup
- Frontend static site served via nginx, reverse-proxying `/auth`, `/boards`, `/tasks`, etc. to the backend

A self-ping keepalive runs every 4 minutes to prevent Render's free tier from sleeping the backend.

---

## Team

| Name | Student ID |
|---|---|
| Bimuratov Madiyar | 230103253 |
| Sanzhar Sydybek | 230103139 |
| Shakirov Serik | 230103112 |
