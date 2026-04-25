import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowLeft, LayoutGrid, Loader2, Plus, UserPlus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Board, Column, Task, Member, Profile, Role } from "@/lib/board-types";
import { initials } from "@/lib/board-types";
import { ColumnCard } from "@/components/board/ColumnCard";
import { TaskCard } from "@/components/board/TaskCard";
import { TaskDetailModal } from "@/components/board/TaskDetailModal";
import { InviteModal } from "@/components/board/InviteModal";

export const Route = createFileRoute("/board/$id")({
  component: BoardPage,
});

function BoardPage() {
  const { id: boardId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newCol, setNewCol] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: b, error: be }, { data: cols, error: ce }, { data: ms, error: me }] = await Promise.all([
          supabase.from("boards").select("id,title,owner_id").eq("id", boardId).maybeSingle(),
          supabase.from("columns").select("*").eq("board_id", boardId).order("position"),
          supabase
            .from("board_members")
            .select("user_id, role, profile:profiles(id,email,display_name)")
            .eq("board_id", boardId),
        ]);
        if (cancelled) return;
        if (be || ce || me) throw be || ce || me;
        if (!b) {
          toast.error("Board not found or access denied");
          navigate({ to: "/dashboard" });
          return;
        }
        setBoard(b);
        setTitleDraft(b.title);
        setColumns(cols ?? []);
        const memberRows = (ms ?? []).map((m) => ({
          user_id: m.user_id,
          role: m.role as Role,
          profile: (m.profile as unknown as Profile),
        }));
        setMembers(memberRows);
        const myRole = memberRows.find((m) => m.user_id === user.id)?.role ?? null;
        setRole(myRole);

        const colIds = (cols ?? []).map((c) => c.id);
        if (colIds.length > 0) {
          const { data: ts, error: te } = await supabase
            .from("tasks")
            .select("*")
            .in("column_id", colIds)
            .order("position");
          if (te) throw te;
          if (!cancelled) setTasks(ts ?? []);
        } else {
          setTasks([]);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load board");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, user, navigate]);

  // Realtime
  useEffect(() => {
    if (!user || !board) return;
    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const t = payload.new as Task;
              if (prev.find((x) => x.id === t.id)) return prev;
              return [...prev, t];
            }
            if (payload.eventType === "UPDATE") {
              const t = payload.new as Task;
              return prev.map((x) => (x.id === t.id ? t : x));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<Task>;
              return prev.filter((x) => x.id !== old.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "columns", filter: `board_id=eq.${boardId}` },
        (payload) => {
          setColumns((prev) => {
            if (payload.eventType === "INSERT") {
              const c = payload.new as Column;
              if (prev.find((x) => x.id === c.id)) return prev;
              return [...prev, c].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const c = payload.new as Column;
              return prev.map((x) => (x.id === c.id ? c : x)).sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<Column>;
              return prev.filter((x) => x.id !== old.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` },
        async () => {
          const { data: ms } = await supabase
            .from("board_members")
            .select("user_id, role, profile:profiles(id,email,display_name)")
            .eq("board_id", boardId);
          if (ms) {
            const rows = ms.map((m) => ({
              user_id: m.user_id,
              role: m.role as Role,
              profile: (m.profile as unknown as Profile),
            }));
            setMembers(rows);
          }
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setLive(false);
    };
  }, [boardId, user, board]);

  const canEdit = role === "admin" || role === "editor";
  const isViewer = role === "viewer";

  const memberMap = useMemo(() => {
    const m = new Map<string, Profile>();
    members.forEach((mem) => m.set(mem.user_id, mem.profile));
    return m;
  }, [members]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    columns.forEach((c) => map.set(c.id, []));
    tasks.forEach((t) => {
      const arr = map.get(t.column_id);
      if (arr) arr.push(t);
    });
    map.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [columns, tasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.type === "task") setActiveTask(data.task as Task);
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;
    if (activeData?.type !== "task") return;

    const activeTaskObj = activeData.task as Task;
    let targetColumnId: string | null = null;

    if (overData?.type === "task") {
      targetColumnId = (overData.task as Task).column_id;
    } else if (overData?.type === "column-drop") {
      targetColumnId = overData.columnId as string;
    } else if (overData?.type === "column") {
      targetColumnId = (overData.column as Column).id;
    }

    if (targetColumnId && targetColumnId !== activeTaskObj.column_id) {
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTaskObj.id ? { ...t, column_id: targetColumnId! } : t)),
      );
    }
  };

  const persistPositions = async (affected: Task[]) => {
    const updates = affected.map((t) =>
      supabase.from("tasks").update({ column_id: t.column_id, position: t.position }).eq("id", t.id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) throw err.error;
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const activeData = active.data.current;
    if (!activeData) return;

    // Column reordering
    if (activeData.type === "column" && over.data.current?.type === "column" && active.id !== over.id) {
      const oldIdx = columns.findIndex((c) => c.id === active.id);
      const newIdx = columns.findIndex((c) => c.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const prevCols = columns;
      const newCols = arrayMove(columns, oldIdx, newIdx).map((c, i) => ({ ...c, position: i }));
      setColumns(newCols);
      try {
        await Promise.all(
          newCols.map((c) => supabase.from("columns").update({ position: c.position }).eq("id", c.id)),
        );
      } catch {
        setColumns(prevCols);
        toast.error("Failed to reorder columns");
      }
      return;
    }

    if (activeData.type !== "task") return;
    const activeTaskObj = activeData.task as Task;
    const overData = over.data.current;

    let targetColumnId = activeTaskObj.column_id;
    let overTaskId: string | null = null;
    if (overData?.type === "task") {
      const ot = overData.task as Task;
      targetColumnId = ot.column_id;
      overTaskId = ot.id;
    } else if (overData?.type === "column-drop") {
      targetColumnId = overData.columnId as string;
    } else if (overData?.type === "column") {
      targetColumnId = (overData.column as Column).id;
    }

    // Compute new ordering
    const prevTasks = tasks;
    const currentTask = tasks.find((t) => t.id === active.id);
    if (!currentTask) return;
    const sourceColId = currentTask.column_id !== targetColumnId ? currentTask.column_id : null;

    // Remove from current position
    const without = tasks.filter((t) => t.id !== active.id);
    const targetTasks = without.filter((t) => t.column_id === targetColumnId);
    let insertIdx = targetTasks.length;
    if (overTaskId) {
      insertIdx = targetTasks.findIndex((t) => t.id === overTaskId);
      if (insertIdx === -1) insertIdx = targetTasks.length;
    }
    const moved = { ...currentTask, column_id: targetColumnId };
    targetTasks.splice(insertIdx, 0, moved);
    const renumberedTarget = targetTasks.map((t, i) => ({ ...t, position: i }));

    let renumberedSource: Task[] = [];
    if (sourceColId) {
      const src = without.filter((t) => t.column_id === sourceColId);
      renumberedSource = src.map((t, i) => ({ ...t, position: i }));
    }

    const others = without.filter(
      (t) => t.column_id !== targetColumnId && t.column_id !== sourceColId,
    );
    const next = [...others, ...renumberedTarget, ...renumberedSource];
    setTasks(next);

    try {
      const affected = [...renumberedTarget, ...renumberedSource];
      await persistPositions(affected);
    } catch (err) {
      setTasks(prevTasks);
      toast.error(err instanceof Error ? err.message : "Failed to move task");
    }
  };

  const addColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCol.trim()) return;
    const maxPos = columns.reduce((m, c) => Math.max(m, c.position), -1);
    const { data, error } = await supabase
      .from("columns")
      .insert({ board_id: boardId, title: newCol.trim(), position: maxPos + 1 })
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (data) setColumns((prev) => [...prev.filter((c) => c.id !== data.id), data].sort((a, b) => a.position - b.position));
    setNewCol("");
    setAddingColumn(false);
    toast.success("Column added");
  };

  const renameColumn = async (id: string, title: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    const { error } = await supabase.from("columns").update({ title }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const addTask = useCallback(
    async (columnId: string, title: string) => {
      const colTasks = tasks.filter((t) => t.column_id === columnId);
      const maxPos = colTasks.reduce((m, t) => Math.max(m, t.position), -1);
      const { data, error } = await supabase
        .from("tasks")
        .insert({ column_id: columnId, title, position: maxPos + 1, priority: "medium" })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data) setTasks((prev) => (prev.find((t) => t.id === data.id) ? prev : [...prev, data]));
      toast.success("Task added");
    },
    [tasks],
  );

  const saveBoardTitle = async () => {
    setEditingTitle(false);
    if (!board || !titleDraft.trim() || titleDraft === board.title) {
      setTitleDraft(board?.title ?? "");
      return;
    }
    const { error } = await supabase.from("boards").update({ title: titleDraft.trim() }).eq("id", board.id);
    if (error) {
      toast.error(error.message);
      setTitleDraft(board.title);
    } else {
      setBoard({ ...board, title: titleDraft.trim() });
    }
  };

  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center shrink-0">
            <LayoutGrid className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          {editingTitle && canEdit ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveBoardTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setTitleDraft(board.title);
                  setEditingTitle(false);
                }
              }}
              className="bg-input border border-border rounded px-2 py-1 text-sm font-semibold flex-1 min-w-0 max-w-xs"
            />
          ) : (
            <h1
              onClick={() => canEdit && setEditingTitle(true)}
              className={`text-sm font-semibold tracking-tight truncate ${canEdit ? "cursor-pointer hover:text-primary" : ""}`}
            >
              {board.title}
            </h1>
          )}
          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "bg-live animate-pulse" : "bg-muted-foreground/40"}`}
            />
            {live ? "Live" : "…"}
          </span>
          {isViewer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shrink-0">
              <Eye className="h-3 w-3" /> View only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <div
                key={m.user_id}
                title={m.profile.display_name || m.profile.email}
                className="h-7 w-7 rounded-full bg-primary/20 text-[10px] font-medium text-primary flex items-center justify-center border-2 border-background"
              >
                {initials(m.profile)}
              </div>
            ))}
            {members.length > 5 && (
              <div className="h-7 w-7 rounded-full bg-muted text-[10px] text-muted-foreground flex items-center justify-center border-2 border-background">
                +{members.length - 5}
              </div>
            )}
          </div>
          {role === "admin" && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 p-4 min-w-max items-start">
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((col) => (
                <ColumnCard
                  key={col.id}
                  column={col}
                  tasks={tasksByColumn.get(col.id) ?? []}
                  members={memberMap}
                  canEdit={canEdit}
                  onTaskClick={(t) => setOpenTaskId(t.id)}
                  onAddTask={addTask}
                  onRenameColumn={renameColumn}
                />
              ))}
            </SortableContext>

            {canEdit && (
              <div className="w-[280px] shrink-0">
                {addingColumn ? (
                  <form onSubmit={addColumn} className="rounded-xl bg-column border border-border/50 p-3">
                    <input
                      autoFocus
                      value={newCol}
                      onChange={(e) => setNewCol(e.target.value)}
                      onBlur={() => !newCol && setAddingColumn(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setNewCol("");
                          setAddingColumn(false);
                        }
                      }}
                      placeholder="Column title…"
                      className="w-full bg-input border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={!newCol.trim()}
                      className="mt-2 w-full text-xs bg-primary text-primary-foreground rounded py-1.5 hover:bg-primary/90 transition disabled:opacity-60"
                    >
                      Add column
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/30 hover:bg-card hover:border-primary/40 transition py-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Add column
                  </button>
                )}
              </div>
            )}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rounded-lg bg-task border border-primary/50 p-3 shadow-xl rotate-2">
                <p className="text-sm">{activeTask.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {openTask && (
        <TaskDetailModal
          task={openTask}
          members={members}
          canEdit={canEdit}
          onClose={() => setOpenTaskId(null)}
          onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
          onUpdated={(t) => setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)))}
        />
      )}

      {showInvite && (
        <InviteModal boardId={boardId} onClose={() => setShowInvite(false)} onInvited={() => {}} />
      )}
    </div>
  );
}
