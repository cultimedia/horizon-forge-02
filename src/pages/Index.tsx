import { useHorizons } from '@/hooks/useHorizons';
import { HorizonSelector } from '@/components/HorizonSelector';
import { TaskInput } from '@/components/TaskInput';
import { HorizonView } from '@/components/HorizonView';
import { ConstellationView } from '@/components/ConstellationView';
import { TodayView } from '@/components/TodayView';

const Index = () => {
  const {
    horizons,
    tasks,
    activeHorizon,
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
  } = useHorizons();

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

  return (
    <div className="min-h-screen">
      {/* Header with app name */}
      <header className="border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="font-display text-2xl text-foreground tracking-wide">
            Horizons
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Architecture for the long game
          </p>
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
            tasks={getTasksForHorizon(activeHorizon.id)}
            horizons={horizons}
            onToggleComplete={toggleTaskComplete}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
          />
        )}

        {viewMode === 'constellation' && (
          <ConstellationView
            horizons={horizons}
            tasks={tasks}
            onToggleComplete={toggleTaskComplete}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onSelectHorizon={handleSelectHorizonFromConstellation}
          />
        )}

        {viewMode === 'today' && (
          <TodayView
            tasks={tasks}
            horizons={horizons}
            onToggleComplete={toggleTaskComplete}
            onUpdateTask={updateTask}
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
