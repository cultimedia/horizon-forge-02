import { Task, Horizon } from '@/types/horizon';
import { TaskItem } from './TaskItem';
import { StarIcon } from './StarIcon';
import { cn } from '@/lib/utils';

interface ConstellationViewProps {
  horizons: Horizon[];
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onSelectHorizon: (id: string) => void;
}

export function ConstellationView({
  horizons,
  tasks,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
  onSelectHorizon,
}: ConstellationViewProps) {
  const getTasksForHorizon = (horizonId: string) =>
    tasks.filter(t => t.horizonId === horizonId && !t.completed).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="text-center mb-8 animate-fade-in">
        <h2 className="font-display text-3xl text-foreground mb-2">Constellation</h2>
        <p className="text-muted-foreground font-body">All horizons at a glance</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {horizons.map((horizon, index) => {
          const horizonTasks = getTasksForHorizon(horizon.id);
          const totalTasks = tasks.filter(t => t.horizonId === horizon.id && !t.completed).length;

          return (
            <div
              key={horizon.id}
              className={cn(
                'gradient-card border border-border/50 rounded-xl p-6',
                'transition-all duration-300 hover:border-star/30',
                'animate-fade-in cursor-pointer'
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => onSelectHorizon(horizon.id)}
            >
              <div className="flex items-center gap-3 mb-4">
                <StarIcon active size="lg" />
                <h3 className="font-display text-2xl text-foreground">{horizon.name}</h3>
                <span className="text-sm font-body text-muted-foreground ml-auto">
                  {totalTasks} active
                </span>
              </div>

              <div className="space-y-1">
                {horizonTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2">
                    All clear on this horizon
                  </p>
                ) : (
                  horizonTasks.map((task) => (
                    <div key={task.id} onClick={(e) => e.stopPropagation()}>
                      <TaskItem
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onUpdate={onUpdateTask}
                        onDelete={onDeleteTask}
                      />
                    </div>
                  ))
                )}

                {totalTasks > 5 && (
                  <p className="text-sm text-star font-body pt-2">
                    +{totalTasks - 5} more tasks
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
