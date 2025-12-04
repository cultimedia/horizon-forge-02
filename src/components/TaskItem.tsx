import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Task, Horizon } from '@/types/horizon';
import { Check, Trash2 } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  horizon?: Horizon;
  showHorizonBadge?: boolean;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({
  task,
  horizon,
  showHorizonBadge = false,
  onToggleComplete,
  onUpdate,
  onDelete,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout>();

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = undefined;
      // Double click - edit
      setIsEditing(true);
    } else {
      // Single click - wait to confirm it's not a double click
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = undefined;
        onToggleComplete(task.id);
      }, 250);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editValue.trim()) {
      onUpdate(task.id, { title: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    setTimeout(() => onDelete(task.id), 300);
  };

  if (isEditing) {
    return (
      <form onSubmit={handleEditSubmit} className="group">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          className={cn(
            'w-full px-4 py-3 bg-input border border-star/50 rounded-lg',
            'font-body text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-star/30'
          )}
        />
      </form>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer',
        'transition-all duration-300',
        'hover:bg-secondary/50',
        task.completed && 'opacity-40',
        isOverdue && 'border-l-2 border-l-overdue',
        isDeleting && 'opacity-0 translate-x-4'
      )}
    >
      {/* Completion indicator */}
      <div
        className={cn(
          'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0',
          'transition-all duration-300',
          task.completed
            ? 'bg-star/20 border-star text-star'
            : 'border-border group-hover:border-star/50'
        )}
      >
        {task.completed && <Check className="w-3 h-3" />}
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-body text-foreground truncate',
            task.completed && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </p>
        
        <div className="flex items-center gap-2 mt-1">
          {showHorizonBadge && horizon && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-horizon-badge text-muted-foreground font-body">
              {horizon.name}
            </span>
          )}
          
          {task.dueDate && (
            <span className={cn(
              'text-xs font-body',
              isOverdue ? 'text-overdue' : 'text-muted-foreground'
            )}>
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
