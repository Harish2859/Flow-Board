const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('fb_token');
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem('fb_token', t);
  else localStorage.removeItem('fb_token');
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export const api = {
  // Auth
  signup: (email: string, password: string) =>
    req<{ token: string; user: UserProfile }>('POST', '/api/auth/signup', { email, password }),
  login: (email: string, password: string) =>
    req<{ token: string; user: UserProfile }>('POST', '/api/auth/login', { email, password }),
  me: () => req<UserProfile>('GET', '/api/auth/me'),

  // Boards
  getBoards: () => req<BoardRow[]>('GET', '/api/boards'),
  createBoard: (title: string) => req<BoardRow>('POST', '/api/boards', { title }),
  getBoard: (id: string) => req<BoardRow>('GET', `/api/boards/${id}`),
  updateBoard: (id: string, title: string) => req<BoardRow>('PATCH', `/api/boards/${id}`, { title }),

  // Members
  getMembers: (boardId: string) => req<MemberRow[]>('GET', `/api/boards/${boardId}/members`),
  inviteMember: (boardId: string, email: string) =>
    req<{ ok: boolean }>('POST', `/api/boards/${boardId}/members`, { email }),

  // Columns
  getColumns: (boardId: string) => req<ColumnRow[]>('GET', `/api/boards/${boardId}/columns`),
  createColumn: (boardId: string, title: string, position: number) =>
    req<ColumnRow>('POST', `/api/boards/${boardId}/columns`, { title, position }),
  updateColumn: (id: string, patch: Partial<ColumnRow>) =>
    req<ColumnRow>('PATCH', `/api/columns/${id}`, patch),
  reorderColumns: (updates: { id: string; position: number }[]) =>
    req<{ ok: boolean }>('POST', '/api/columns/reorder', updates),

  // Tasks
  getTasks: (boardId: string) => req<TaskRow[]>('GET', `/api/boards/${boardId}/tasks`),
  createTask: (column_id: string, title: string, position: number) =>
    req<TaskRow>('POST', '/api/tasks', { column_id, title, position, priority: 'medium' }),
  updateTask: (id: string, patch: Partial<TaskRow>) =>
    req<TaskRow>('PATCH', `/api/tasks/${id}`, patch),
  deleteTask: (id: string) => req<{ ok: boolean }>('DELETE', `/api/tasks/${id}`),
  reorderTasks: (updates: { id: string; column_id: string; position: number }[]) =>
    req<{ ok: boolean }>('POST', '/api/tasks/reorder', updates),
};

// Shared types (mirrors board-types.ts)
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
}

export interface BoardRow {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  member_count: number;
}

export interface MemberRow {
  user_id: string;
  role: string;
  profile: UserProfile;
}

export interface ColumnRow {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface TaskRow {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}
