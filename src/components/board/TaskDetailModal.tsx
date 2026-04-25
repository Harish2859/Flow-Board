import { useEffect, useState } from 'react';
import { X, Trash2, Loader2, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import type { Task, Member, Priority } from '@/lib/board-types';
import { priorityColor, initials } from '@/lib/board-types';
import { toast } from 'sonner';

interface Props {
  task: Task;
  members: Member[];
  canEdit: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (t: Task) => void;
}

export function TaskDetailModal({ task, members, canEdit, onClose, onDeleted, onUpdated }: Props) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assigned, setAssigned] = useState<string | null>(task.assigned_to);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDesc(task.description ?? '');
    setPriority(task.priority);
    setAssigned(task.assigned_to);
  }, [task]);

  const update = async (patch: Partial<Task>) => {
    try {
      const data = await api.updateTask(task.id, patch);
      onUpdated(data as unknown as Task);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      toast.success('Task deleted');
      onDeleted(task.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 sm:items-center overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && update({ title: title.trim() })}
            className="flex-1 bg-transparent border-none outline-none text-lg font-semibold focus:ring-0"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">#{task.id.slice(0, 8)}</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(task.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            disabled={!canEdit}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => desc !== (task.description ?? '') && update({ description: desc || null })}
            rows={4}
            placeholder={canEdit ? 'Add a description…' : 'No description'}
            className="mt-1.5 w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="mt-5">
          <label className="text-xs font-medium text-muted-foreground">Priority</label>
          <div className="mt-1.5 flex gap-2">
            {(['low', 'medium', 'high'] as Priority[]).map((p) => (
              <button
                key={p}
                disabled={!canEdit}
                onClick={() => { setPriority(p); update({ priority: p }); }}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium capitalize transition ${priority === p ? 'bg-accent border-primary text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                <span className={`h-2 w-2 rounded-full ${priorityColor(p)}`} />
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs font-medium text-muted-foreground">Assigned to</label>
          <select
            disabled={!canEdit}
            value={assigned ?? ''}
            onChange={(e) => { const v = e.target.value || null; setAssigned(v); update({ assigned_to: v }); }}
            className="mt-1.5 w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile.display_name || m.profile.email}
              </option>
            ))}
          </select>
          {assigned && members.find((m) => m.user_id === assigned) && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-5 w-5 rounded-full bg-primary/20 text-[9px] font-medium text-primary flex items-center justify-center">
                {initials(members.find((m) => m.user_id === assigned)!.profile)}
              </div>
              {members.find((m) => m.user_id === assigned)?.profile.display_name ||
                members.find((m) => m.user_id === assigned)?.profile.email}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mt-6 pt-4 border-t border-border">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">Are you sure?</span>
                <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground px-3 py-1.5 hover:text-foreground">Cancel</button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs bg-destructive text-destructive-foreground rounded-md px-3 py-1.5 hover:bg-destructive/90 transition"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Delete
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition">
                <Trash2 className="h-3.5 w-3.5" /> Delete task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
