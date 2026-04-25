export type Priority = "low" | "medium" | "high";
export type Role = "admin" | "editor" | "viewer";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
}

export interface Task {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: Priority;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface Member {
  user_id: string;
  role: Role;
  profile: Profile;
}

export interface Board {
  id: string;
  title: string;
  owner_id: string;
}

export const priorityColor = (p: Priority) =>
  p === "high" ? "bg-priority-high" : p === "medium" ? "bg-priority-medium" : "bg-priority-low";

export const initials = (p: Profile) => {
  const name = p.display_name || p.email;
  return name.slice(0, 2).toUpperCase();
};
