import { Task, Horizon } from '@/types/horizon';
import { TaskSection } from './TaskSection';

interface HorizonViewProps {
  horizon: Horizon;
  tasks: Task[];
  horizons: Horizon[];
  onToggleComplete: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

export function HorizonView({
  horizon,
  tasks,
  horizons,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
}: HorizonViewProps) {
  const todayTasks = tasks.filter(t => t.timeframe === 'today');
  const weekTasks = tasks.filter(t => t.timeframe === 'week');
  const backlogTasks = tasks.filter(t => t.timeframe === 'backlog');

  return (
    <div className="space-y-8">
      <TaskSection
        title="Today"
        timeframe="today"
        tasks={todayTasks}
        horizons={horizons}
        onToggleComplete={onToggleComplete}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />

      <TaskSection
        title="This Week"
        timeframe="week"
        tasks={weekTasks}
        horizons={horizons}
        onToggleComplete={onToggleComplete}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />

      <TaskSection
        title="Backlog"
        timeframe="backlog"
        tasks={backlogTasks}
        horizons={horizons}
        onToggleComplete={onToggleComplete}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    </div>
  );
}
