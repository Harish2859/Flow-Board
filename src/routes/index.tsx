import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { LayoutGrid, Zap, Users, MoveRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <LayoutGrid className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">FlowBoard</span>
        </div>
        <Link
          to="/auth"
          className="text-sm rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse" />
          Live realtime sync
        </div>
        <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Collaborative task boards,
          <br />
          <span className="text-primary">in real time.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          FlowBoard is a Trello-inspired workspace with multi-user sync, drag-and-drop columns, and
          dense, keyboard-friendly UI. No fluff. Just flow.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            Get started <MoveRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-24 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Live sync", body: "Changes appear instantly across every viewer." },
            { icon: LayoutGrid, title: "Drag & drop", body: "Reorder tasks within and across columns." },
            { icon: Users, title: "Roles", body: "Admin, editor, and viewer permissions per board." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
