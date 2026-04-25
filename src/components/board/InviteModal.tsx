import { useState } from "react";
import { X, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  boardId: string;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteModal({ boardId, onClose, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: profile, error: e1 } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (e1) throw e1;
      if (!profile) {
        toast.error("User not registered");
        return;
      }
      const { error: e2 } = await supabase
        .from("board_members")
        .insert({ board_id: boardId, user_id: profile.id, role: "editor" });
      if (e2) {
        if (e2.code === "23505") {
          toast.error("User is already a member");
          return;
        }
        throw e2;
      }
      toast.success("Member invited");
      onInvited();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite member
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Invite a registered user by email. They'll join as editor.</p>
        <form onSubmit={submit}>
          <input
            autoFocus
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Send invite
          </button>
        </form>
      </div>
    </div>
  );
}
