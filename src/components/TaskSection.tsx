import { cn } from '@/lib/utils';
import { Task, Horizon, Timeframe } from '@/types/horizon';
import { TaskItem } from './TaskItem';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface TaskSectionProps {
  title: string;
  timeframe: Timeframe;
  tasks: Task[];
  horizons: Horizon[];
  showHorizonBadge?: boolean;
  onToggleComplete: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

export function TaskSection({
  title,
  timeframe,
  tasks,
  horizons,
  showHorizonBadge = false,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
}: TaskSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const getHorizonForTask = (task: Task) => horizons.find(h => h.id === task.horizonId);

  return (
    <section className="animate-fade-in" style={{ animationDelay: timeframe === 'today' ? '0ms' : timeframe === 'week' ? '100ms' : '200ms' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 mb-3 group"
      >
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            !isExpanded && '-rotate-90'
          )}
        />
        <h3 className="font-display text-xl text-foreground">
          {title}
        </h3>
        <span className="text-sm font-body text-muted-foreground">
          {incompleteTasks.length}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-1 ml-6">
          {incompleteTasks.length === 0 && completedTasks.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">
              No tasks yet
            </p>
          )}

          {incompleteTasks.map((task, index) => (
            <div
              key={task.id}
              className="animate-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <TaskItem
                task={task}
                horizon={getHorizonForTask(task)}
                horizons={horizons}
                showHorizonBadge={showHorizonBadge}
                onToggleComplete={onToggleComplete}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
              />
            </div>
          ))}

          {completedTasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground mb-2 font-body uppercase tracking-wider">
                Completed
              </p>
              {completedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  horizon={getHorizonForTask(task)}
                  horizons={horizons}
                  showHorizonBadge={showHorizonBadge}
                  onToggleComplete={onToggleComplete}
                  onUpdate={onUpdateTask}
                  onDelete={onDeleteTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
