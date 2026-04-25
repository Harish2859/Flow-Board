import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { LayoutGrid, Plus, Users, LogOut, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

interface BoardRow {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  member_count: number;
}

function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const { data: boards, isLoading } = useQuery({
    queryKey: ["boards", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BoardRow[]> => {
      const { data: memberships, error: e1 } = await supabase
        .from("board_members")
        .select("board_id")
        .eq("user_id", user!.id);
      if (e1) throw e1;
      const ids = (memberships ?? []).map((m) => m.board_id);
      if (ids.length === 0) return [];
      const { data: bs, error: e2 } = await supabase
        .from("boards")
        .select("id, title, owner_id, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (e2) throw e2;
      // Member counts
      const { data: counts, error: e3 } = await supabase
        .from("board_members")
        .select("board_id")
        .in("board_id", ids);
      if (e3) throw e3;
      const countMap = new Map<string, number>();
      (counts ?? []).forEach((c) => countMap.set(c.board_id, (countMap.get(c.board_id) ?? 0) + 1));
      return (bs ?? []).map((b) => ({ ...b, member_count: countMap.get(b.id) ?? 1 }));
    },
  });

  const create = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from("boards")
        .insert({ title, owner_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (b) => {
      toast.success("Board created");
      setShowNew(false);
      setNewTitle("");
      qc.invalidateQueries({ queryKey: ["boards"] });
      navigate({ to: "/board/$id", params: { id: b.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <LayoutGrid className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">FlowBoard</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
          <button
            onClick={() => signOut().then(() => navigate({ to: "/" }))}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your boards</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {boards?.length ?? 0} board{boards?.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" /> New board
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (boards?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
            <LayoutGrid className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">No boards yet. Create your first board.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards!.map((b) => (
              <Link
                key={b.id}
                to="/board/$id"
                params={{ id: b.id }}
                className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition"
              >
                <div className="h-2 w-12 rounded-full bg-primary mb-4 group-hover:w-16 transition-all" />
                <h3 className="font-semibold tracking-tight group-hover:text-primary transition">
                  {b.title}
                </h3>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {b.member_count} member{b.member_count === 1 ? "" : "s"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Create board</h2>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newTitle.trim()) create.mutate(newTitle.trim());
              }}
            >
              <input
                autoFocus
                placeholder="Board title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={create.isPending || !newTitle.trim()}
                className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
