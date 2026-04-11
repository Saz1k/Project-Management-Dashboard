import { FormEvent, useEffect, useMemo, useState } from "react";

type Token = {
  access_token: string;
  token_type: string;
};

type User = {
  id: number;
  email: string;
  name: string | null;
  created_at?: string;
};

type MemberShort = {
  id: number;
  name: string | null;
  email: string;
};

type Invitation = {
  id: number;
  board_id: number;
  status: string;
  created_at: string;
  board: { id: number; title: string };
  inviter: MemberShort;
  invitee: MemberShort;
};

type Board = {
  id: number;
  title: string;
  description: string | null;
  owner_id: number;
  created_at: string;
  members: MemberShort[];
};

type Column = {
  id: number;
  title: string;
  board_id: number;
  position: number;
};

type Label = {
  id: number;
  name: string;
  color: string;
  board_id: number;
};

type Priority = "low" | "medium" | "high" | "critical";

type ChecklistItem = {
  id: number;
  task_id: number;
  text: string;
  completed: boolean;
  position: number;
};

type Task = {
  id: number;
  title: string;
  description: string | null;
  column_id: number;
  position: number;
  assignee_id: number | null;
  due_date: string | null;
  priority: Priority | null;
  created_at: string;
  labels: Label[];
  checklist: ChecklistItem[];
};

type Comment = {
  id: number;
  content: string;
  task_id: number;
  author_id: number;
  created_at: string;
};

type ApiError = {
  detail?: string | Array<{ msg: string; loc?: string[] }>;
};

type TaskDraft = {
  title: string;
  description: string;
  due_date: string;
  priority: Priority | "";
};

type TaskDetailDraft = {
  title: string;
  description: string;
  due_date: string;
  assignee_id: string;
  priority: Priority | "";
};

type FilterState = {
  search: string;
  assignee: string;
  label: string;
  priority: Priority | "";
  overdue: boolean;
};

const PRIORITY_LABEL: Record<Priority, string> = { low: "Низкий", medium: "Средний", high: "Высокий", critical: "Критичный" };
const PRIORITY_COLOR: Record<Priority, string> = { low: "#22c55e", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };

const TOKEN_KEY = "pm-proj-token";
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormLike = init.body instanceof FormData || init.body instanceof URLSearchParams;
  if (!headers.has("Content-Type") && init.body && !isFormLike) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Ошибка: ${response.status}`;
    try {
      const payload = (await response.json()) as ApiError;
      if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((e) => e.msg.replace(/^Value error,\s*/i, ""))
          .join("; ");
      } else if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

function formatDate(input: string | null): string {
  if (!input) {
    return "No due date";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(input));
}

function formatDateTime(input: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

function toDatetimeLocal(input: string | null): string {
  if (!input) {
    return "";
  }
  const date = new Date(input);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function getTaskDraft(drafts: Record<number, TaskDraft>, columnId: number): TaskDraft {
  return drafts[columnId] ?? { title: "", description: "", due_date: "", priority: "" };
}

function datePart(dt: string): string {
  return dt ? dt.split("T")[0] : "";
}

function timePart(dt: string): string {
  return dt ? (dt.split("T")[1] ?? "") : "";
}

function joinDatetime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasksByColumn, setTasksByColumn] = useState<Record<number, Task[]>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [boardDraft, setBoardDraft] = useState({ title: "", description: "" });
  const [boardEditor, setBoardEditor] = useState({ title: "", description: "" });
  const [columnTitle, setColumnTitle] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<Record<number, TaskDraft>>({});
  const [labelDraft, setLabelDraft] = useState({ name: "", color: "#2563eb" });
  const [commentDraft, setCommentDraft] = useState("");
  const [taskDetailDraft, setTaskDetailDraft] = useState<TaskDetailDraft>({
    title: "",
    description: "",
    due_date: "",
    assignee_id: "",
    priority: "",
  });
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [addingTaskCol, setAddingTaskCol] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<FilterState>({ search: "", assignee: "", label: "", priority: "", overdue: false });
  const [showFilters, setShowFilters] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [boardPendingInvites, setBoardPendingInvites] = useState<Invitation[]>([]);
  const [showInvites, setShowInvites] = useState(false);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])),
    [users],
  );

  const totalTasks = useMemo(
    () => Object.values(tasksByColumn).reduce((sum, tasks) => sum + tasks.length, 0),
    [tasksByColumn],
  );

  const allTasks = useMemo(() => Object.values(tasksByColumn).flat(), [tasksByColumn]);

  const overdueCount = useMemo(
    () => allTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length,
    [allTasks],
  );

  const todayCount = useMemo(() => {
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return allTasks.filter((t) => t.due_date && new Date(t.due_date) >= start && new Date(t.due_date) <= today).length;
  }, [allTasks]);

  const boardUsers = useMemo(() => {
    if (!selectedBoard) return [];
    const memberIds = new Set([selectedBoard.owner_id, ...(selectedBoard.members ?? []).map((m) => m.id)]);
    return users.filter((u) => memberIds.has(u.id));
  }, [selectedBoard, users]);

  const filteredTasksByColumn = useMemo(() => {
    const result: Record<number, Task[]> = {};
    const now = new Date();
    for (const [colId, tasks] of Object.entries(tasksByColumn)) {
      result[Number(colId)] = tasks.filter((t) => {
        if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.assignee && String(t.assignee_id) !== filters.assignee) return false;
        if (filters.label && !t.labels.some((l) => String(l.id) === filters.label)) return false;
        if (filters.priority && t.priority !== filters.priority) return false;
        if (filters.overdue && !(t.due_date && new Date(t.due_date) < now)) return false;
        return true;
      });
    }
    return result;
  }, [tasksByColumn, filters]);

  const hasFilters = filters.search || filters.assignee || filters.label || filters.priority || filters.overdue;

  useEffect(() => {
    if (!token) {
      setMe(null);
      setUsers([]);
      setBoards([]);
      setSelectedBoardId(null);
      return;
    }

    void bootstrap();
  }, [token]);

  useEffect(() => {
    if (!selectedBoardId || !token) {
      setColumns([]);
      setTasksByColumn({});
      setLabels([]);
      return;
    }

    void loadBoard(selectedBoardId);
  }, [selectedBoardId, token]);

  useEffect(() => {
    if (!selectedBoard) {
      setBoardEditor({ title: "", description: "" });
      return;
    }
    setBoardEditor({
      title: selectedBoard.title,
      description: selectedBoard.description ?? "",
    });
  }, [selectedBoard]);

  useEffect(() => {
    if (!activeTask || !token) {
      setComments([]);
      setTaskDetailDraft({
        title: "",
        description: "",
        due_date: "",
        assignee_id: "",
        priority: "",
      });
      return;
    }

    setTaskDetailDraft({
      title: activeTask.title,
      description: activeTask.description ?? "",
      due_date: toDatetimeLocal(activeTask.due_date),
      assignee_id: activeTask.assignee_id ? String(activeTask.assignee_id) : "",
      priority: activeTask.priority ?? "",
    });
    void loadComments(activeTask.id);
  }, [activeTask, token]);

  async function bootstrap() {
    try {
      setLoading(true);
      setError("");
      const [profile, allUsers, boardList, inviteList] = await Promise.all([
        request<User>("/auth/me", {}, token),
        request<User[]>("/auth/users", {}, token),
        request<Board[]>("/boards/", {}, token),
        request<Invitation[]>("/invitations/", {}, token),
      ]);
      setMe(profile);
      setUsers(allUsers);
      setBoards(boardList);
      setPendingInvites(inviteList);
      setSelectedBoardId((current) => current ?? boardList[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
      signOut();
    } finally {
      setLoading(false);
    }
  }

  async function loadBoard(boardId: number) {
    try {
      setLoading(true);
      setError("");
      const [boardColumns, boardLabels] = await Promise.all([
        request<Column[]>(`/boards/${boardId}/columns`, {}, token),
        request<Label[]>(`/boards/${boardId}/labels`, {}, token),
      ]);
      const orderedColumns = sortByPosition(boardColumns);
      const taskEntries = await Promise.all(
        orderedColumns.map(async (column) => [
          column.id,
          sortByPosition(await request<Task[]>(`/columns/${column.id}/tasks`, {}, token)),
        ] as const),
      );
      const nextTasksByColumn = Object.fromEntries(taskEntries);
      setColumns(orderedColumns);
      setLabels(boardLabels);
      setTasksByColumn(nextTasksByColumn);
      setActiveTask((current) => {
        if (!current) {
          return null;
        }
        return Object.values(nextTasksByColumn)
          .flat()
          .find((task) => task.id === current.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelectedBoard() {
    if (selectedBoardId) {
      await loadBoard(selectedBoardId);
    }
  }

  async function loadComments(taskId: number) {
    try {
      const taskComments = await request<Comment[]>(`/tasks/${taskId}/comments`, {}, token);
      setComments(taskComments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    }
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMe(null);
    setUsers([]);
    setBoards([]);
    setColumns([]);
    setTasksByColumn({});
    setSelectedBoardId(null);
    setActiveTask(null);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authMode === "register") {
      if (authForm.password.length < 8) {
        setError("Пароль должен содержать минимум 8 символов");
        return;
      }
      if (!/[A-Za-z]/.test(authForm.password) || !/[0-9]/.test(authForm.password)) {
        setError("Пароль должен содержать буквы и цифры");
        return;
      }
    }
    try {
      setLoading(true);
      setError("");
      if (authMode === "register") {
        await request<User>("/auth/register", {
          method: "POST",
          body: JSON.stringify(authForm),
        });
      }

      const form = new URLSearchParams();
      form.set("username", authForm.email);
      form.set("password", authForm.password);

      const payload = await request<Token>("/auth/login", {
        method: "POST",
        body: form,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      localStorage.setItem(TOKEN_KEY, payload.access_token);
      setToken(payload.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function createBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!boardDraft.title.trim()) {
      return;
    }
    try {
      const board = await request<Board>(
        "/boards/",
        {
          method: "POST",
          body: JSON.stringify({
            title: boardDraft.title,
            description: boardDraft.description || null,
          }),
        },
        token,
      );
      setBoards((current) => [board, ...current]);
      setSelectedBoardId(board.id);
      setBoardDraft({ title: "", description: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    }
  }

  async function saveBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBoardId || !boardEditor.title.trim()) {
      return;
    }
    try {
      setSavingBoard(true);
      const updated = await request<Board>(
        `/boards/${selectedBoardId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: boardEditor.title,
            description: boardEditor.description || null,
          }),
        },
        token,
      );
      setBoards((current) => current.map((board) => (board.id === updated.id ? updated : board)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update board");
    } finally {
      setSavingBoard(false);
    }
  }

  async function deleteBoard(boardId: number) {
    if (!confirm("Удалить доску вместе со всеми колонками и задачами? Это действие нельзя отменить.")) return;
    try {
      await request<void>(`/boards/${boardId}`, { method: "DELETE" }, token);
      const remaining = boards.filter((b) => b.id !== boardId);
      setBoards(remaining);
      setSelectedBoardId(remaining[0]?.id ?? null);
      setShowSettings(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить доску");
    }
  }

  async function createColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBoardId || !columnTitle.trim()) {
      return;
    }
    try {
      await request<Column>(
        `/boards/${selectedBoardId}/columns`,
        {
          method: "POST",
          body: JSON.stringify({ title: columnTitle }),
        },
        token,
      );
      setColumnTitle("");
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create column");
    }
  }

  async function createTask(columnId: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = getTaskDraft(taskDrafts, columnId);
    if (!draft.title.trim()) {
      return;
    }
    try {
      await request<Task>(
        `/columns/${columnId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            title: draft.title,
            description: draft.description || null,
            due_date: draft.due_date ? new Date(draft.due_date).toISOString() : null,
            priority: draft.priority || null,
          }),
        },
        token,
      );
      setTaskDrafts((current) => ({
        ...current,
        [columnId]: { title: "", description: "", due_date: "", priority: "" },
      }));
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  async function createLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBoardId || !labelDraft.name.trim()) {
      return;
    }
    try {
      await request<Label>(
        `/boards/${selectedBoardId}/labels`,
        {
          method: "POST",
          body: JSON.stringify(labelDraft),
        },
        token,
      );
      setLabelDraft({ name: "", color: "#2563eb" });
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create label");
    }
  }

  async function updateTaskDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTask || !taskDetailDraft.title.trim()) {
      return;
    }
    try {
      setSavingTask(true);
      const updated = await request<Task>(
        `/tasks/${activeTask.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: taskDetailDraft.title,
            description: taskDetailDraft.description || null,
            due_date: taskDetailDraft.due_date ? new Date(taskDetailDraft.due_date).toISOString() : null,
            assignee_id: taskDetailDraft.assignee_id ? Number(taskDetailDraft.assignee_id) : null,
            priority: taskDetailDraft.priority || null,
          }),
        },
        token,
      );
      setActiveTask(updated);
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setSavingTask(false);
    }
  }

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTask || !commentDraft.trim()) {
      return;
    }
    try {
      const nextComment = await request<Comment>(
        `/tasks/${activeTask.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ content: commentDraft }),
        },
        token,
      );
      setComments((current) => [...current, nextComment]);
      setCommentDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create comment");
    }
  }

  async function toggleTaskLabel(label: Label) {
    if (!activeTask) {
      return;
    }
    const assigned = activeTask.labels.some((item) => item.id === label.id);
    try {
      await request<void>(
        `/tasks/${activeTask.id}/labels/${label.id}`,
        {
          method: assigned ? "DELETE" : "POST",
        },
        token,
      );
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task labels");
    }
  }

  async function moveTask(task: Task, columnId: number) {
    const nextPosition = tasksByColumn[columnId]?.length ?? 0;
    try {
      await request<Task>(
        `/tasks/${task.id}/move`,
        {
          method: "POST",
          body: JSON.stringify({
            column_id: columnId,
            position: nextPosition,
          }),
        },
        token,
      );
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
    }
  }

  async function deleteTask(taskId: number) {
    try {
      await request<void>(`/tasks/${taskId}`, { method: "DELETE" }, token);
      if (activeTask?.id === taskId) {
        setActiveTask(null);
      }
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  async function deleteColumn(columnId: number) {
    if (!confirm("Удалить колонку вместе со всеми задачами?")) return;
    try {
      await request<void>(`/columns/${columnId}`, { method: "DELETE" }, token);
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete column");
    }
  }

  async function addChecklistItem(taskId: number) {
    if (!newChecklistText.trim()) return;
    try {
      await request<ChecklistItem>(`/tasks/${taskId}/checklist`, { method: "POST", body: JSON.stringify({ text: newChecklistText }) }, token);
      setNewChecklistText("");
      await refreshSelectedBoard();
      const updated = await request<Task>(`/tasks/${taskId}`, {}, token);
      setActiveTask(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add checklist item");
    }
  }

  async function toggleChecklistItem(taskId: number, item: ChecklistItem) {
    try {
      await request<ChecklistItem>(`/checklist/${item.id}`, { method: "PATCH", body: JSON.stringify({ completed: !item.completed }) }, token);
      const updated = await request<Task>(`/tasks/${taskId}`, {}, token);
      setActiveTask(updated);
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update checklist item");
    }
  }

  async function deleteChecklistItem(taskId: number, itemId: number) {
    try {
      await request<void>(`/checklist/${itemId}`, { method: "DELETE" }, token);
      const updated = await request<Task>(`/tasks/${taskId}`, {}, token);
      setActiveTask(updated);
      await refreshSelectedBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete checklist item");
    }
  }

  function toggleColCollapse(colId: number) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      next.has(colId) ? next.delete(colId) : next.add(colId);
      return next;
    });
  }

  async function removeMember(userId: number) {
    if (!selectedBoardId) return;
    try {
      const updated = await request<Board>(
        `/boards/${selectedBoardId}/members/${userId}`,
        { method: "DELETE" },
        token,
      );
      setBoards((curr) => curr.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить участника");
    }
  }

  async function sendInvitation(userId: number) {
    if (!selectedBoardId) return;
    try {
      await request<Invitation>(
        `/invitations/boards/${selectedBoardId}`,
        { method: "POST", body: JSON.stringify({ user_id: userId }) },
        token,
      );
      setAddMemberSearch("");
      const invites = await request<Invitation[]>(`/boards/${selectedBoardId}/invitations`, {}, token);
      setBoardPendingInvites(invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить приглашение");
    }
  }

  async function acceptInvitation(invId: number) {
    try {
      await request<Invitation>(`/invitations/${invId}/accept`, { method: "POST" }, token);
      const [invites, boardList] = await Promise.all([
        request<Invitation[]>("/invitations/", {}, token),
        request<Board[]>("/boards/", {}, token),
      ]);
      setPendingInvites(invites);
      setBoards(boardList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка принятия приглашения");
    }
  }

  async function rejectInvitation(invId: number) {
    try {
      await request<Invitation>(`/invitations/${invId}/reject`, { method: "POST" }, token);
      setPendingInvites((curr) => curr.filter((i) => i.id !== invId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отклонения приглашения");
    }
  }

  async function cancelInvitation(invId: number) {
    try {
      await request<void>(`/invitations/${invId}`, { method: "DELETE" }, token);
      setBoardPendingInvites((curr) => curr.filter((i) => i.id !== invId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отмены приглашения");
    }
  }

  async function loadBoardPendingInvites(boardId: number) {
    try {
      const invites = await request<Invitation[]>(`/boards/${boardId}/invitations`, {}, token);
      setBoardPendingInvites(invites);
    } catch {
      setBoardPendingInvites([]);
    }
  }

  if (!token || !me) {
    return (
      <div className="auth-page">
        <section className="auth-card">
          <div className="auth-copy">
            <span className="kicker">PM Dashboard</span>
            <h1>Управляй задачами без лишнего шума.</h1>
            <p>Доски, колонки, задачи, исполнители и комментарии — всё в одном месте.</p>
          </div>
          <div className="auth-form-wrap">
            <div className="auth-tabs">
              <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Войти</button>
              <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Регистрация</button>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <label className="field">
                  <span>Имя</span>
                  <input value={authForm.name} onChange={(e) => setAuthForm((c) => ({ ...c, name: e.target.value }))} placeholder="Иван Иванов" />
                </label>
              )}
              <label className="field">
                <span>Email</span>
                <input value={authForm.email} onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" type="email" />
              </label>
              <label className="field">
                <span>Пароль</span>
                <input value={authForm.password} onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))} placeholder="••••••" type="password" />
              </label>
              {error && <div className="alert error">{error}</div>}
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? "Подождите…" : authMode === "login" ? "Войти" : "Создать аккаунт"}
              </button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⬡</span>
          <span className="brand-name">PM Board</span>
        </div>

        <div className="sidebar-section-label">Мои доски</div>
        <div className="board-list">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              className={`board-item ${board.id === selectedBoardId ? "active" : ""}`}
              onClick={() => { setSelectedBoardId(board.id); setShowNewBoard(false); }}
            >
              <span className="board-item-icon">{board.title.charAt(0).toUpperCase()}</span>
              <span className="board-item-text">
                <strong>{board.title}</strong>
                <small>{board.owner_id !== me.id ? "👥 Общая" : (board.description || "Без описания")}</small>
              </span>
            </button>
          ))}
        </div>

        {showNewBoard ? (
          <form className="new-board-form" onSubmit={async (e) => { await createBoard(e); setShowNewBoard(false); }}>
            <input value={boardDraft.title} onChange={(e) => setBoardDraft((c) => ({ ...c, title: e.target.value }))} placeholder="Название доски" autoFocus />
            <input value={boardDraft.description} onChange={(e) => setBoardDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Описание (необяз.)" />
            <div className="new-board-actions">
              <button type="submit" className="primary-button">Создать</button>
              <button type="button" className="ghost-button" onClick={() => setShowNewBoard(false)}>Отмена</button>
            </div>
          </form>
        ) : (
          <button type="button" className="add-board-btn" onClick={() => setShowNewBoard(true)}>
            <span>+</span> Новая доска
          </button>
        )}

        <div className="sidebar-bottom">
          {pendingInvites.length > 0 && (
            <button type="button" className={`invite-notify-btn ${showInvites ? "active" : ""}`} onClick={() => setShowInvites((v) => !v)}>
              🔔 Приглашения
              <span className="invite-count">{pendingInvites.length}</span>
            </button>
          )}
          <button type="button" className="ghost-button sidebar-signout" onClick={signOut}>
            Выйти · {me.name || me.email}
          </button>
        </div>

        {/* Pending invitations panel */}
        {showInvites && pendingInvites.length > 0 && (
          <div className="invite-panel">
            <div className="invite-panel-title">Входящие приглашения</div>
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="invite-card">
                <div className="invite-card-info">
                  <strong>{inv.board.title}</strong>
                  <span>от {inv.inviter.name || inv.inviter.email}</span>
                </div>
                <div className="invite-card-actions">
                  <button type="button" className="primary-button" onClick={() => void acceptInvitation(inv.id)}>✓</button>
                  <button type="button" className="secondary-button" onClick={() => void rejectInvitation(inv.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* ── Main ───────────────────────────────────────── */}
      <div className="main-area">
        {error && <div className="alert error top-alert">{error}</div>}

        {selectedBoard ? (
          <>
            {/* Board topbar */}
            <div className="board-bar">
              <div className="board-bar-left">
                <h1 className="board-title">{selectedBoard.title}</h1>
                <div className="board-stats">
                  <span>{totalTasks} задач</span>
                  {overdueCount > 0 && <span className="stat-danger">⚠ {overdueCount} просрочено</span>}
                  {todayCount > 0 && <span className="stat-warning">🔔 {todayCount} сегодня</span>}
                </div>
              </div>
              <div className="board-bar-right">
                {(selectedBoard.members ?? []).length > 0 && (
                  <div className="board-avatars">
                    {[usersById[selectedBoard.owner_id], ...(selectedBoard.members ?? [])].filter(Boolean).slice(0, 5).map((u) => (
                      <div key={u.id} className="board-avatar" title={u.name || u.email}>
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
                <div className="view-toggle">
                  <button type="button" className={viewMode === "kanban" ? "active" : ""} onClick={() => setViewMode("kanban")} title="Канбан">⊞</button>
                  <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="Список">≡</button>
                </div>
                <button type="button" className={`bar-btn ${showFilters || hasFilters ? "active" : ""}`} onClick={() => { setShowLabels(false); setShowSettings(false); setShowFilters((v) => !v); }}>⚡ Фильтры{hasFilters ? " ●" : ""}</button>
                <button type="button" className="bar-btn" onClick={() => { setShowLabels(true); setShowSettings(false); }}>🏷 Метки</button>
                <button type="button" className="bar-btn" onClick={() => { setShowSettings(true); setShowLabels(false); if (selectedBoard?.owner_id === me.id) void loadBoardPendingInvites(selectedBoard.id); }}>⚙ Настройки</button>
              </div>
            </div>

            {/* Filter bar */}
            {showFilters && <div className="filter-bar">
              <input className="filter-search" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="🔍 Поиск по названию…" />
              <select className="filter-select" value={filters.assignee} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}>
                <option value="">Все исполнители</option>
                {boardUsers.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
              <select className="filter-select" value={filters.label} onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}>
                <option value="">Все метки</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select className="filter-select" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as Priority | "" }))}>
                <option value="">Все приоритеты</option>
                {(["low","medium","high","critical"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
              <label className="filter-check">
                <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters((f) => ({ ...f, overdue: e.target.checked }))} />
                Только просроченные
              </label>
              {hasFilters && <button type="button" className="ghost-button" onClick={() => setFilters({ search: "", assignee: "", label: "", priority: "", overdue: false })}>✕ Сбросить</button>}
            </div>}

            {/* Settings inline panel */}
            {showSettings && (
              <div className="inline-panel">
                <div className="inline-panel-header">
                  <strong>Настройки доски</strong>
                  <button type="button" className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
                </div>
                <div className="settings-columns">
                  {selectedBoard.owner_id === me.id && (
                    <form className="inline-panel-form" onSubmit={async (e) => { await saveBoard(e); setShowSettings(false); }}>
                      <label className="field"><span>Название</span><input value={boardEditor.title} onChange={(e) => setBoardEditor((c) => ({ ...c, title: e.target.value }))} /></label>
                      <label className="field"><span>Описание</span><textarea value={boardEditor.description} onChange={(e) => setBoardEditor((c) => ({ ...c, description: e.target.value }))} rows={2} /></label>
                      <button type="submit" className="primary-button" disabled={savingBoard}>{savingBoard ? "Сохранение…" : "Сохранить"}</button>
                      <button type="button" className="delete-board-btn" onClick={() => void deleteBoard(selectedBoard.id)}>🗑 Удалить доску</button>
                    </form>
                  )}

                  {/* Members section */}
                  <div className="members-section">
                    <div className="modal-section-title">Участники</div>

                    {/* Owner */}
                    <div className="member-row">
                      <div className="member-avatar">{(usersById[selectedBoard.owner_id]?.name || usersById[selectedBoard.owner_id]?.email || "?").charAt(0).toUpperCase()}</div>
                      <div className="member-info">
                        <span className="member-name">{usersById[selectedBoard.owner_id]?.name || usersById[selectedBoard.owner_id]?.email}</span>
                        <span className="member-role">Владелец</span>
                      </div>
                    </div>

                    {/* Invited members */}
                    {(selectedBoard.members ?? []).map((member) => (
                      <div key={member.id} className="member-row">
                        <div className="member-avatar">{(member.name || member.email).charAt(0).toUpperCase()}</div>
                        <div className="member-info">
                          <span className="member-name">{member.name || member.email}</span>
                          <span className="member-role">Участник</span>
                        </div>
                        {selectedBoard.owner_id === me.id && (
                          <button type="button" className="member-remove" onClick={() => void removeMember(member.id)} title="Удалить">✕</button>
                        )}
                      </div>
                    ))}

                    {/* Pending invitations sent by owner */}
                    {selectedBoard.owner_id === me.id && boardPendingInvites.map((inv) => (
                      <div key={inv.id} className="member-row pending">
                        <div className="member-avatar pending-avatar">{(inv.invitee.name || inv.invitee.email).charAt(0).toUpperCase()}</div>
                        <div className="member-info">
                          <span className="member-name">{inv.invitee.name || inv.invitee.email}</span>
                          <span className="member-role pending-label">Ожидает ответа…</span>
                        </div>
                        <button type="button" className="member-remove" onClick={() => void cancelInvitation(inv.id)} title="Отменить приглашение">✕</button>
                      </div>
                    ))}

                    {/* Invite member — only for owner */}
                    {selectedBoard.owner_id === me.id && (
                      <div className="member-add">
                        <select
                          value={addMemberSearch}
                          onChange={(e) => setAddMemberSearch(e.target.value)}
                        >
                          <option value="">Пригласить пользователя…</option>
                          {users
                            .filter((u) =>
                              u.id !== selectedBoard.owner_id &&
                              !(selectedBoard.members ?? []).some((m) => m.id === u.id) &&
                              !boardPendingInvites.some((i) => i.invitee.id === u.id)
                            )
                            .map((u) => (
                              <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={!addMemberSearch}
                          onClick={() => void sendInvitation(Number(addMemberSearch))}
                        >
                          Пригласить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Labels inline panel */}
            {showLabels && (
              <div className="inline-panel">
                <div className="inline-panel-header">
                  <strong>Метки доски</strong>
                  <button type="button" className="close-btn" onClick={() => setShowLabels(false)}>✕</button>
                </div>
                <div className="labels-grid">
                  {labels.map((label) => (
                    <span key={label.id} className="label-chip" style={{ background: `${label.color}20`, border: `1.5px solid ${label.color}50`, color: label.color }}>{label.name}</span>
                  ))}
                </div>
                <form className="inline-panel-form" onSubmit={createLabel}>
                  <div className="label-create-row">
                    <input value={labelDraft.name} onChange={(e) => setLabelDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Название метки" />
                    <label className="color-pick">
                      <input type="color" value={labelDraft.color} onChange={(e) => setLabelDraft((c) => ({ ...c, color: e.target.value }))} />
                      <span className="color-preview" style={{ background: labelDraft.color }} />
                    </label>
                  </div>
                  <button type="submit" className="primary-button">Добавить метку</button>
                </form>
              </div>
            )}

            {/* List view */}
            {viewMode === "list" && (
              <div className="list-view">
                {columns.map((column) => {
                  const columnTasks = filteredTasksByColumn[column.id] ?? [];
                  return (
                    <div key={column.id} className="list-group">
                      <div className="list-group-header">
                        <span className="list-group-title">{column.title}</span>
                        <span className="col-count">{columnTasks.length}</span>
                      </div>
                      {columnTasks.length === 0 ? (
                        <div className="list-empty">Нет задач</div>
                      ) : columnTasks.map((task) => {
                        const assignee = task.assignee_id ? usersById[task.assignee_id] : null;
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                        return (
                          <div key={task.id} className="list-row" onClick={() => setActiveTask(task)}>
                            <div className="list-row-main">
                              {task.priority && (
                                <span className="priority-badge" style={{ color: PRIORITY_COLOR[task.priority], background: `${PRIORITY_COLOR[task.priority]}18`, borderColor: `${PRIORITY_COLOR[task.priority]}40` }}>
                                  {PRIORITY_LABEL[task.priority]}
                                </span>
                              )}
                              <span className="list-row-title">{task.title}</span>
                            </div>
                            <div className="list-row-meta">
                              {task.labels.map((label) => (
                                <span key={label.id} className="task-label" style={{ background: `${label.color}22`, borderColor: `${label.color}55`, color: label.color }}>{label.name}</span>
                              ))}
                              {task.due_date && <span className={`task-due ${isOverdue ? "overdue" : ""}`}>📅 {formatDate(task.due_date)}</span>}
                              {assignee && <span className="task-assignee">👤 {assignee.name || assignee.email}</span>}
                              {task.checklist.length > 0 && (
                                <span className="task-due">{task.checklist.filter((i) => i.completed).length}/{task.checklist.length} ✓</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="move-chip danger"
                              onClick={(e) => { e.stopPropagation(); void deleteTask(task.id); }}
                            >🗑</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kanban */}
            {viewMode === "kanban" && <div className="kanban-scroll">
              <div className="kanban-board">
                {columns.map((column) => {
                  const draft = getTaskDraft(taskDrafts, column.id);
                  const columnTasks = filteredTasksByColumn[column.id] ?? [];
                  const isCollapsed = collapsedCols.has(column.id);
                  return (
                    <article
                      key={column.id}
                      className={`column-panel ${dragOverCol === column.id ? "drag-over" : ""} ${isCollapsed ? "collapsed" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCol(column.id); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCol(null);
                        if (draggingTask && draggingTask.column_id !== column.id) {
                          void moveTask(draggingTask, column.id);
                        }
                        setDraggingTask(null);
                      }}
                    >
                      <div className="column-header">
                        <button type="button" className="col-collapse-btn" onClick={() => toggleColCollapse(column.id)} title={isCollapsed ? "Развернуть" : "Свернуть"}>
                          {isCollapsed ? "▶" : "▼"}
                        </button>
                        <h3>{column.title}</h3>
                        <div className="col-header-right">
                          <span className="col-count">{columnTasks.length}</span>
                          <button type="button" className="col-delete-btn" title="Удалить колонку" onClick={() => void deleteColumn(column.id)}>🗑</button>
                        </div>
                      </div>

                      {!isCollapsed && <div className="task-list">
                        {columnTasks.map((task) => {
                          const assignee = task.assignee_id ? usersById[task.assignee_id] : null;
                          const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                          return (
                            <button
                                key={task.id}
                                type="button"
                                className={`task-card ${draggingTask?.id === task.id ? "dragging" : ""}`}
                                draggable
                                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDraggingTask(task); }}
                                onDragEnd={() => { setDraggingTask(null); setDragOverCol(null); }}
                                onClick={() => setActiveTask(task)}
                              >
                              <div className="task-card-top">
                                {task.priority && (
                                  <span className="priority-badge" style={{ color: PRIORITY_COLOR[task.priority], background: `${PRIORITY_COLOR[task.priority]}18`, borderColor: `${PRIORITY_COLOR[task.priority]}40` }}>
                                    {PRIORITY_LABEL[task.priority]}
                                  </span>
                                )}
                                {task.labels.map((label) => (
                                  <span key={label.id} className="task-label" style={{ background: `${label.color}22`, borderColor: `${label.color}55`, color: label.color }}>{label.name}</span>
                                ))}
                              </div>
                              <strong className="task-title">{task.title}</strong>
                              {task.description && <p className="task-desc">{task.description}</p>}
                              {task.checklist.length > 0 && (
                                <div className="checklist-progress">
                                  <div className="checklist-bar">
                                    <div className="checklist-fill" style={{ width: `${(task.checklist.filter((i) => i.completed).length / task.checklist.length) * 100}%` }} />
                                  </div>
                                  <span>{task.checklist.filter((i) => i.completed).length}/{task.checklist.length}</span>
                                </div>
                              )}
                              <div className="task-meta">
                                {task.due_date && <span className={`task-due ${isOverdue ? "overdue" : ""}`}>📅 {formatDate(task.due_date)}</span>}
                                {assignee && <span className="task-assignee">👤 {assignee.name || assignee.email}</span>}
                              </div>
                              <div className="task-card-actions">
                                <span className="move-chip danger" onClick={(e) => { e.stopPropagation(); void deleteTask(task.id); }}>🗑 Удалить</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>}

                      {!isCollapsed && addingTaskCol === column.id ? (
                        <form className="add-task-form" onSubmit={(e) => { void createTask(column.id, e).then(() => setAddingTaskCol(null)); }}>
                          <input
                            value={draft.title}
                            onChange={(e) => setTaskDrafts((c) => ({ ...c, [column.id]: { ...getTaskDraft(c, column.id), title: e.target.value } }))}
                            placeholder="Название задачи"
                            autoFocus
                          />
                          <textarea
                            value={draft.description}
                            onChange={(e) => setTaskDrafts((c) => ({ ...c, [column.id]: { ...getTaskDraft(c, column.id), description: e.target.value } }))}
                            placeholder="Описание (необяз.)"
                            rows={2}
                          />
                          <div className="date-time-row">
                            <label className="field">
                              <span>Дата</span>
                              <input
                                type="date"
                                value={datePart(draft.due_date)}
                                onChange={(e) => setTaskDrafts((c) => ({ ...c, [column.id]: { ...getTaskDraft(c, column.id), due_date: joinDatetime(e.target.value, timePart(getTaskDraft(c, column.id).due_date)) } }))}
                              />
                            </label>
                            <label className="field">
                              <span>Время</span>
                              <input
                                type="time"
                                value={timePart(draft.due_date)}
                                onChange={(e) => setTaskDrafts((c) => ({ ...c, [column.id]: { ...getTaskDraft(c, column.id), due_date: joinDatetime(datePart(getTaskDraft(c, column.id).due_date), e.target.value) } }))}
                              />
                            </label>
                          </div>
                          <label className="field">
                            <span>Приоритет</span>
                            <select value={draft.priority} onChange={(e) => setTaskDrafts((c) => ({ ...c, [column.id]: { ...getTaskDraft(c, column.id), priority: e.target.value as Priority | "" } }))}>
                              <option value="">Без приоритета</option>
                              {(["low","medium","high","critical"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                            </select>
                          </label>
                          <div className="add-task-actions">
                            <button type="submit" className="primary-button">Добавить</button>
                            <button type="button" className="ghost-button" onClick={() => setAddingTaskCol(null)}>Отмена</button>
                          </div>
                        </form>
                      ) : (
                        !isCollapsed && <button type="button" className="add-task-btn" onClick={() => setAddingTaskCol(column.id)}>+ Добавить задачу</button>
                      )}
                    </article>
                  );
                })}

                {/* Add column */}
                <div className="add-column-panel">
                  {addingColumn ? (
                    <form onSubmit={async (e) => { await createColumn(e); setAddingColumn(false); }} className="add-col-form">
                      <input value={columnTitle} onChange={(e) => setColumnTitle(e.target.value)} placeholder="Название колонки" autoFocus />
                      <div className="add-task-actions">
                        <button type="submit" className="primary-button">Создать</button>
                        <button type="button" className="ghost-button" onClick={() => setAddingColumn(false)}>Отмена</button>
                      </div>
                    </form>
                  ) : (
                    <button type="button" className="add-column-btn" onClick={() => setAddingColumn(true)}>+ Добавить колонку</button>
                  )}
                </div>
              </div>
            </div>}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">⬡</div>
            <h2>Выберите доску</h2>
            <p>Выберите доску из списка слева или создайте новую.</p>
          </div>
        )}
      </div>

      {/* ── Task modal ─────────────────────────────────── */}
      {activeTask && (
        <div className="modal-backdrop" onClick={() => setActiveTask(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Детали задачи</h2>
              <button type="button" className="close-btn" onClick={() => setActiveTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-left">
                <form className="form-stack" onSubmit={updateTaskDetails}>
                  <label className="field">
                    <span>Название</span>
                    <input value={taskDetailDraft.title} onChange={(e) => setTaskDetailDraft((c) => ({ ...c, title: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Описание</span>
                    <textarea value={taskDetailDraft.description} onChange={(e) => setTaskDetailDraft((c) => ({ ...c, description: e.target.value }))} rows={4} placeholder="Добавьте описание…" />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      <span>Дата</span>
                      <input type="date" value={datePart(taskDetailDraft.due_date)} onChange={(e) => setTaskDetailDraft((c) => ({ ...c, due_date: joinDatetime(e.target.value, timePart(c.due_date)) }))} />
                    </label>
                    <label className="field">
                      <span>Время</span>
                      <input type="time" value={timePart(taskDetailDraft.due_date)} onChange={(e) => setTaskDetailDraft((c) => ({ ...c, due_date: joinDatetime(datePart(c.due_date), e.target.value) }))} />
                    </label>
                  </div>
                  <div className="field-row">
                    <label className="field">
                      <span>Исполнитель</span>
                      <select value={taskDetailDraft.assignee_id} onChange={(e) => setTaskDetailDraft((c) => ({ ...c, assignee_id: e.target.value }))}>
                        <option value="">Не назначен</option>
                        {boardUsers.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>Приоритет</span>
                      <select value={taskDetailDraft.priority} onChange={(e) => setTaskDetailDraft((c) => ({ ...c, priority: e.target.value as Priority | "" }))}>
                        <option value="">Без приоритета</option>
                        {(["low","medium","high","critical"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="primary-button" disabled={savingTask}>{savingTask ? "Сохранение…" : "Сохранить изменения"}</button>
                </form>

                <div className="modal-section">
                  <div className="modal-section-title">Чеклист · {activeTask.checklist.filter((i) => i.completed).length}/{activeTask.checklist.length}</div>
                  {activeTask.checklist.length > 0 && (
                    <div className="checklist-bar-full">
                      <div className="checklist-fill" style={{ width: `${(activeTask.checklist.filter((i) => i.completed).length / activeTask.checklist.length) * 100}%` }} />
                    </div>
                  )}
                  <div className="checklist-list">
                    {activeTask.checklist.map((item) => (
                      <div key={item.id} className={`checklist-item ${item.completed ? "done" : ""}`}>
                        <input type="checkbox" checked={item.completed} onChange={() => void toggleChecklistItem(activeTask.id, item)} />
                        <span>{item.text}</span>
                        <button type="button" className="checklist-del" onClick={() => void deleteChecklistItem(activeTask.id, item.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="checklist-add">
                    <input value={newChecklistText} onChange={(e) => setNewChecklistText(e.target.value)} placeholder="Новый пункт…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addChecklistItem(activeTask.id); } }} />
                    <button type="button" className="primary-button" onClick={() => void addChecklistItem(activeTask.id)}>+</button>
                  </div>
                </div>

                <div className="modal-section">
                  <div className="modal-section-title">Метки</div>
                  <div className="toggle-list">
                    {labels.length === 0 && <span className="muted-text">Нет меток. Создайте их через кнопку «Метки» на доске.</span>}
                    {labels.map((label) => {
                      const assigned = activeTask.labels.some((item) => item.id === label.id);
                      return (
                        <button key={label.id} type="button" className={`toggle-pill ${assigned ? "active" : ""}`}
                          style={{ borderColor: `${label.color}55`, color: label.color, background: assigned ? `${label.color}18` : "transparent" }}
                          onClick={() => void toggleTaskLabel(label)}>
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-right">
                <div className="modal-section-title">Комментарии · {comments.length}</div>
                <form className="form-stack" onSubmit={createComment}>
                  <textarea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} rows={3} placeholder="Напишите комментарий…" />
                  <button type="submit" className="secondary-button solid">Отправить</button>
                </form>
                <div className="comment-list">
                  {comments.map((comment) => (
                    <article key={comment.id} className="comment-card">
                      <div className="comment-card-header">
                        <strong>{usersById[comment.author_id]?.name || usersById[comment.author_id]?.email || `Пользователь #${comment.author_id}`}</strong>
                        <span>{formatDateTime(comment.created_at)}</span>
                      </div>
                      <p>{comment.content}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
