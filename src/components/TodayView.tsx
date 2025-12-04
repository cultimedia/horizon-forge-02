import { Task, Horizon } from '@/types/horizon';
import { TaskItem } from './TaskItem';
import { Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayViewProps {
  tasks: Task[];
  horizons: Horizon[];
  onToggleComplete: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

export function TodayView({
  tasks,
  horizons,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
}: TodayViewProps) {
  const todayTasks = tasks.filter(t => t.timeframe === 'today');
  const incompleteTasks = todayTasks.filter(t => !t.completed);
  const completedTasks = todayTasks.filter(t => t.completed);

  const getHorizonForTask = (task: Task) => horizons.find(h => h.id === task.horizonId);

  // Group by horizon
  const tasksByHorizon = horizons.reduce((acc, horizon) => {
    const horizonTasks = incompleteTasks.filter(t => t.horizonId === horizon.id);
    if (horizonTasks.length > 0) {
      acc[horizon.id] = horizonTasks;
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-8">
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center gap-3 mb-2">
          <Sun className="w-8 h-8 text-star" />
          <h2 className="font-display text-3xl text-foreground">Today</h2>
        </div>
        <p className="text-muted-foreground font-body">{today}</p>
      </div>

      {Object.keys(tasksByHorizon).length === 0 && completedTasks.length === 0 ? (
        <div className="text-center py-12 animate-fade-in">
          <p className="text-muted-foreground font-body text-lg">
            A clear day ahead
          </p>
          <p className="text-muted-foreground/60 font-body text-sm mt-2">
            Add tasks to any horizon to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(tasksByHorizon).map(([horizonId, horizonTasks], index) => {
            const horizon = horizons.find(h => h.id === horizonId);
            if (!horizon) return null;

            return (
              <div
                key={horizonId}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <h3 className="font-display text-xl text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-star" />
                  {horizon.name}
                </h3>
                <div className="space-y-1 ml-4">
                  {horizonTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      horizon={horizon}
                      onToggleComplete={onToggleComplete}
                      onUpdate={onUpdateTask}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {completedTasks.length > 0 && (
            <div className="animate-fade-in pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground mb-3 font-body uppercase tracking-wider">
                Completed Today
              </p>
              <div className="space-y-1">
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    horizon={getHorizonForTask(task)}
                    showHorizonBadge
                    onToggleComplete={onToggleComplete}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
