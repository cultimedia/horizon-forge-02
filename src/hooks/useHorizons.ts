import { useState, useEffect, useCallback } from 'react';
import { Horizon, Task, Timeframe, ViewMode } from '@/types/horizon';

const STORAGE_KEY_HORIZONS = 'horizons-data';
const STORAGE_KEY_TASKS = 'horizons-tasks';

const defaultHorizons: Horizon[] = [
  { id: '1', name: 'Sacred Technology', archived: false, createdAt: new Date().toISOString() },
  { id: '2', name: 'Sanctuary Build', archived: false, createdAt: new Date().toISOString() },
  { id: '3', name: 'Family Support', archived: false, createdAt: new Date().toISOString() },
  { id: '4', name: 'Home Systems', archived: false, createdAt: new Date().toISOString() },
];

const defaultTasks: Task[] = [
  { id: '1', title: 'Design meditation space layout', horizonId: '2', timeframe: 'today', completed: false, createdAt: new Date().toISOString() },
  { id: '2', title: 'Research solar panel options', horizonId: '4', timeframe: 'today', completed: false, createdAt: new Date().toISOString() },
  { id: '3', title: 'Schedule call with Mom', horizonId: '3', timeframe: 'today', completed: false, createdAt: new Date().toISOString() },
  { id: '4', title: 'Set up development environment', horizonId: '1', timeframe: 'week', completed: false, createdAt: new Date().toISOString() },
  { id: '5', title: 'Source reclaimed wood for shelving', horizonId: '2', timeframe: 'week', completed: false, createdAt: new Date().toISOString() },
  { id: '6', title: 'Review smart home protocols', horizonId: '4', timeframe: 'week', completed: false, createdAt: new Date().toISOString() },
  { id: '7', title: 'Document API architecture', horizonId: '1', timeframe: 'backlog', completed: false, createdAt: new Date().toISOString() },
  { id: '8', title: 'Plan garden irrigation system', horizonId: '2', timeframe: 'backlog', completed: false, createdAt: new Date().toISOString() },
];

export function useHorizons() {
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeHorizonId, setActiveHorizonId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('horizon');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const storedHorizons = localStorage.getItem(STORAGE_KEY_HORIZONS);
    const storedTasks = localStorage.getItem(STORAGE_KEY_TASKS);

    if (storedHorizons) {
      const parsed = JSON.parse(storedHorizons);
      setHorizons(parsed);
      if (parsed.length > 0) {
        setActiveHorizonId(parsed[0].id);
      }
    } else {
      setHorizons(defaultHorizons);
      setActiveHorizonId(defaultHorizons[0].id);
    }

    if (storedTasks) {
      const parsed: Task[] = JSON.parse(storedTasks);
      // Auto-remove tasks completed more than 24 hours ago
      const filtered = parsed.filter(task => {
        if (!task.completed || !task.completedAt) return true;
        const completedTime = new Date(task.completedAt).getTime();
        const now = Date.now();
        return now - completedTime < 24 * 60 * 60 * 1000;
      });
      setTasks(filtered);
    } else {
      setTasks(defaultTasks);
    }

    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY_HORIZONS, JSON.stringify(horizons));
    }
  }, [horizons, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    }
  }, [tasks, isLoaded]);

  const activeHorizon = horizons.find(h => h.id === activeHorizonId);

  const addHorizon = useCallback((name: string) => {
    const newHorizon: Horizon = {
      id: Date.now().toString(),
      name,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    setHorizons(prev => [...prev, newHorizon]);
    return newHorizon;
  }, []);

  const updateHorizon = useCallback((id: string, updates: Partial<Horizon>) => {
    setHorizons(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  }, []);

  const archiveHorizon = useCallback((id: string) => {
    setHorizons(prev => prev.map(h => h.id === id ? { ...h, archived: true } : h));
    if (activeHorizonId === id) {
      const remaining = horizons.filter(h => h.id !== id && !h.archived);
      if (remaining.length > 0) {
        setActiveHorizonId(remaining[0].id);
      }
    }
  }, [activeHorizonId, horizons]);

  const addTask = useCallback((title: string, horizonId?: string, timeframe: Timeframe = 'today') => {
    // Parse #HorizonName prefix
    let finalHorizonId = horizonId || activeHorizonId;
    let finalTitle = title;

    const prefixMatch = title.match(/^#(\S+)\s+(.+)/);
    if (prefixMatch) {
      const horizonName = prefixMatch[1].toLowerCase();
      const matchedHorizon = horizons.find(h => 
        h.name.toLowerCase().replace(/\s+/g, '') === horizonName ||
        h.name.toLowerCase().startsWith(horizonName)
      );
      if (matchedHorizon) {
        finalHorizonId = matchedHorizon.id;
        finalTitle = prefixMatch[2];
      }
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title: finalTitle,
      horizonId: finalHorizonId,
      timeframe,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [activeHorizonId, horizons]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const toggleTaskComplete = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          completed: !t.completed,
          completedAt: !t.completed ? new Date().toISOString() : undefined,
        };
      }
      return t;
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTasksForHorizon = useCallback((horizonId: string) => {
    return tasks.filter(t => t.horizonId === horizonId);
  }, [tasks]);

  const getTasksByTimeframe = useCallback((horizonId: string, timeframe: Timeframe) => {
    return tasks.filter(t => t.horizonId === horizonId && t.timeframe === timeframe);
  }, [tasks]);

  const getTodayTasks = useCallback(() => {
    return tasks.filter(t => t.timeframe === 'today');
  }, [tasks]);

  const visibleHorizons = horizons.filter(h => !h.archived);

  return {
    horizons: visibleHorizons,
    allHorizons: horizons,
    tasks,
    activeHorizon,
    activeHorizonId,
    setActiveHorizonId,
    viewMode,
    setViewMode,
    addHorizon,
    updateHorizon,
    archiveHorizon,
    addTask,
    updateTask,
    toggleTaskComplete,
    deleteTask,
    getTasksForHorizon,
    getTasksByTimeframe,
    getTodayTasks,
    isLoaded,
  };
}
