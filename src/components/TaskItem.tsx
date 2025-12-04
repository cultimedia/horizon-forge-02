import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Task, Horizon, Timeframe } from '@/types/horizon';
import { Check, Trash2, Calendar, Tag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface TaskItemProps {
  task: Task;
  horizon?: Horizon;
  horizons?: Horizon[];
  showHorizonBadge?: boolean;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({
  task,
  horizon,
  horizons = [],
  showHorizonBadge = false,
  onToggleComplete,
  onUpdate,
  onDelete,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHorizonPicker, setShowHorizonPicker] = useState(false);
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

  const handleDateSelect = (date: Date | undefined) => {
    onUpdate(task.id, { dueDate: date ? date.toISOString() : undefined });
    setShowDatePicker(false);
  };

  const handleHorizonSelect = (horizonId: string) => {
    onUpdate(task.id, { horizonId });
    setShowHorizonPicker(false);
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
            <Popover open={showHorizonPicker} onOpenChange={setShowHorizonPicker}>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="text-xs px-2 py-0.5 rounded-md bg-horizon-badge text-muted-foreground font-body hover:bg-star/20 hover:text-star transition-colors">
                  {horizon.name}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                  {horizons.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleHorizonSelect(h.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm font-body transition-colors',
                        h.id === task.horizonId 
                          ? 'bg-star/20 text-star' 
                          : 'hover:bg-secondary text-foreground'
                      )}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          {/* Due date with picker */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className={cn(
                'text-xs font-body flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors',
                task.dueDate 
                  ? isOverdue 
                    ? 'text-overdue bg-overdue/10 hover:bg-overdue/20' 
                    : 'text-muted-foreground hover:bg-secondary'
                  : 'text-muted-foreground/50 hover:bg-secondary opacity-0 group-hover:opacity-100'
              )}>
                <Calendar className="w-3 h-3" />
                {task.dueDate 
                  ? format(new Date(task.dueDate), 'MMM d')
                  : 'Add date'
                }
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
              <CalendarComponent
                mode="single"
                selected={task.dueDate ? new Date(task.dueDate) : undefined}
                onSelect={handleDateSelect}
                initialFocus
                className="p-3 pointer-events-auto"
              />
              {task.dueDate && (
                <div className="border-t border-border p-2">
                  <button
                    onClick={() => handleDateSelect(undefined)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-secondary transition-colors"
                  >
                    Remove date
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
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
