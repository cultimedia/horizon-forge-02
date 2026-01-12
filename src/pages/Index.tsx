import { useHorizonsDB, Task as DBTask, Horizon as DBHorizon } from '@/hooks/useHorizonsDB';
import { useAuth } from '@/contexts/AuthContext';
import { HorizonSelector } from '@/components/HorizonSelector';
import { TaskInput } from '@/components/TaskInput';
import { HorizonView } from '@/components/HorizonView';
import { ConstellationView } from '@/components/ConstellationView';
import { TodayView } from '@/components/TodayView';
import { Button } from '@/components/ui/button';
import { LogOut, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

// Adapter types to match existing components
interface Task {
  id: string;
  title: string;
  horizonId: string;
  timeframe: 'today' | 'week' | 'backlog';
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

interface Horizon {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
}

// Adapter functions
const adaptTask = (dbTask: DBTask): Task => ({
  id: dbTask.id,
  title: dbTask.title,
  horizonId: dbTask.horizon_id,
  timeframe: dbTask.timeframe,
  dueDate: dbTask.due_date || undefined,
  completed: dbTask.completed,
  completedAt: dbTask.completed_at || undefined,
  createdAt: dbTask.created_at,
});

const adaptHorizon = (dbHorizon: DBHorizon): Horizon => ({
  id: dbHorizon.id,
  name: dbHorizon.name,
  archived: !dbHorizon.is_active,
  createdAt: dbHorizon.created_at,
});

const Index = () => {
  const { signOut } = useAuth();
  const {
    horizons: dbHorizons,
    tasks: dbTasks,
    activeHorizon: dbActiveHorizon,
    activeHorizonId,
    setActiveHorizonId,
    viewMode,
    setViewMode,
    addHorizon,
    addTask,
    updateTask,
    toggleTaskComplete,
    deleteTask,
    getTasksForHorizon,
    isLoaded,
  } = useHorizonsDB();

  // Adapt data for existing components
  const horizons = dbHorizons.map(adaptHorizon);
  const tasks = dbTasks.map(adaptTask);
  const activeHorizon = dbActiveHorizon ? adaptHorizon(dbActiveHorizon) : undefined;

  // Calculate task counts per horizon
  const taskCounts = horizons.reduce((acc, h) => {
    acc[h.id] = tasks.filter(t => t.horizonId === h.id && !t.completed).length;
    return acc;
  }, {} as Record<string, number>);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-star animate-glow-pulse" />
      </div>
    );
  }

  const handleSelectHorizonFromConstellation = (id: string) => {
    setActiveHorizonId(id);
    setViewMode('horizon');
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    // Convert back to DB format
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.timeframe !== undefined) dbUpdates.timeframe = updates.timeframe;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    updateTask(id, dbUpdates);
  };

  const horizonTasks = activeHorizon 
    ? tasks.filter(t => t.horizonId === activeHorizon.id)
    : [];

  return (
    <div className="min-h-screen">
      {/* Header with app name */}
      <header className="border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground tracking-wide">
              Horizons
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Architecture for the long game
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-primary border-primary/30 hover:bg-primary/10"
            >
              <Link to="/capture">
                <Zap className="w-4 h-4 mr-2" />
                Quick Capture
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Horizon Navigation */}
      <HorizonSelector
        horizons={horizons}
        activeHorizonId={activeHorizonId}
        onSelectHorizon={setActiveHorizonId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddHorizon={addHorizon}
        taskCounts={taskCounts}
      />

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Task Input */}
        <div className="mb-8">
          <TaskInput
            activeHorizon={activeHorizon}
            horizons={horizons}
            onAddTask={addTask}
          />
        </div>

        {/* Views */}
        {viewMode === 'horizon' && activeHorizon && (
          <HorizonView
            horizon={activeHorizon}
            tasks={horizonTasks}
            horizons={horizons}
            onToggleComplete={toggleTaskComplete}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={deleteTask}
          />
        )}

        {viewMode === 'constellation' && (
          <ConstellationView
            horizons={horizons}
            tasks={tasks}
            onToggleComplete={toggleTaskComplete}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={deleteTask}
            onSelectHorizon={handleSelectHorizonFromConstellation}
          />
        )}

        {viewMode === 'today' && (
          <TodayView
            tasks={tasks}
            horizons={horizons}
            onToggleComplete={toggleTaskComplete}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={deleteTask}
          />
        )}
      </main>

      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 gradient-glow opacity-30" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 gradient-glow opacity-20" />
      </div>
    </div>
  );
};

export default Index;
