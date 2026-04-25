import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Loader2 } from "lucide-react";
import type { Column, Task, Profile } from "@/lib/board-types";
import { TaskCard } from "./TaskCard";

interface Props {
  column: Column;
  tasks: Task[];
  members: Map<string, Profile>;
  canEdit: boolean;
  onTaskClick: (t: Task) => void;
  onAddTask: (columnId: string, title: string) => Promise<void>;
  onRenameColumn: (columnId: string, title: string) => void;
}

export function ColumnCard({
  column,
  tasks,
  members,
  canEdit,
  onTaskClick,
  onAddTask,
  onRenameColumn,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column", column },
    disabled: !canEdit,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `col-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms ease",
    opacity: isDragging ? 0.5 : 1,
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setBusy(true);
    try {
      await onAddTask(column.id, newTask.trim());
      setNewTask("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col w-[280px] shrink-0 rounded-xl bg-column border border-border/50 max-h-[calc(100vh-8rem)]"
    >
      <div
        {...(canEdit ? attributes : {})}
        {...(canEdit ? listeners : {})}
        className={`px-3 pt-3 pb-2 flex items-center justify-between ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
        onDoubleClick={() => canEdit && setEditing(true)}
      >
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (title.trim() && title !== column.title) onRenameColumn(column.id, title.trim());
              else setTitle(column.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitle(column.title);
                setEditing(false);
              }
            }}
            className="bg-input border border-border rounded px-2 py-1 text-sm font-medium w-full"
          />
        ) : (
          <h3 className="text-sm font-semibold tracking-tight">{column.title}</h3>
        )}
        <span className="text-xs text-muted-foreground font-mono">{tasks.length}</span>
      </div>

      <div ref={setDropRef} className="flex-1 overflow-y-auto px-2 pb-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 min-h-[20px]">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                assignee={t.assigned_to ? members.get(t.assigned_to) : undefined}
                onClick={() => onTaskClick(t)}
                disabled={!canEdit}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {canEdit && (
        <div className="p-2 border-t border-border/50">
          {adding ? (
            <form onSubmit={submitAdd}>
              <input
                autoFocus
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onBlur={() => !newTask && setAdding(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setNewTask("");
                    setAdding(false);
                  }
                }}
                placeholder="Task title…"
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={busy || !newTask.trim()}
                className="mt-2 w-full text-xs bg-primary text-primary-foreground rounded py-1.5 hover:bg-primary/90 transition disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                Add task
              </button>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
