import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Profile } from "@/lib/board-types";
import { priorityColor, initials } from "@/lib/board-types";

interface Props {
  task: Task;
  assignee?: Profile;
  onClick: () => void;
  disabled: boolean;
}

export function TaskCard({ task, assignee, onClick, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms ease",
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only trigger click if not dragging
        if (!isDragging) onClick();
        e.stopPropagation();
      }}
      className={`group rounded-lg bg-task hover:bg-task-hover border border-border/50 p-3 ${
        disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      } transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug flex-1">{task.title}</p>
        <span
          aria-label={`Priority: ${task.priority}`}
          className={`mt-1 h-2 w-2 rounded-full shrink-0 ${priorityColor(task.priority)}`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">
          #{task.id.slice(0, 6)}
        </span>
        {assignee && (
          <div
            title={assignee.display_name || assignee.email}
            className="h-5 w-5 rounded-full bg-primary/20 text-[9px] font-medium text-primary flex items-center justify-center"
          >
            {initials(assignee)}
          </div>
        )}
      </div>
    </div>
  );
}
