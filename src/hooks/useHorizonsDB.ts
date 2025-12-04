import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseDateFromText, getTimeframeFromDate } from '@/utils/dateParser';

export type Timeframe = 'today' | 'week' | 'backlog';
export type ViewMode = 'horizon' | 'constellation' | 'today';

export interface Horizon {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  horizon_id: string;
  title: string;
  timeframe: Timeframe;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useHorizonsDB() {
  const { user } = useAuth();
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeHorizonId, setActiveHorizonId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('horizon');
  const [isLoaded, setIsLoaded] = useState(false);
  const lastUsedHorizonRef = useRef<string>('');

  // Fetch horizons
  const fetchHorizons = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('horizons')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching horizons:', error);
      toast.error('Failed to load horizons');
      return;
    }

    setHorizons(data || []);
    
    // Set active horizon to first one if not set
    if (data && data.length > 0 && !activeHorizonId) {
      setActiveHorizonId(data[0].id);
    }
  }, [user, activeHorizonId]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
      return;
    }

    // Filter out tasks completed more than 24 hours ago and cast timeframe
    const filtered = (data || [])
      .filter(task => {
        if (!task.completed || !task.completed_at) return true;
        const completedTime = new Date(task.completed_at).getTime();
        return Date.now() - completedTime < 24 * 60 * 60 * 1000;
      })
      .map(task => ({
        ...task,
        timeframe: task.timeframe as Timeframe,
      }));

    setTasks(filtered);
  }, [user]);

  // Initial load and real-time subscriptions
  useEffect(() => {
    if (user) {
      Promise.all([fetchHorizons(), fetchTasks()]).then(() => {
        setIsLoaded(true);
      });

      // Set up real-time subscriptions
      const tasksChannel = supabase
        .channel('tasks-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newTask = { ...payload.new, timeframe: payload.new.timeframe as Timeframe } as Task;
              setTasks(prev => [...prev.filter(t => t.id !== newTask.id), newTask]);
            } else if (payload.eventType === 'UPDATE') {
              const updatedTask = { ...payload.new, timeframe: payload.new.timeframe as Timeframe } as Task;
              setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
            } else if (payload.eventType === 'DELETE') {
              setTasks(prev => prev.filter(t => t.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      const horizonsChannel = supabase
        .channel('horizons-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'horizons' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setHorizons(prev => [...prev, payload.new as Horizon]);
            } else if (payload.eventType === 'UPDATE') {
              setHorizons(prev => prev.map(h => h.id === payload.new.id ? payload.new as Horizon : h));
            } else if (payload.eventType === 'DELETE') {
              setHorizons(prev => prev.filter(h => h.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(tasksChannel);
        supabase.removeChannel(horizonsChannel);
      };
    }
  }, [user, fetchHorizons, fetchTasks]);

  // Create default horizons for new users
  const createDefaultHorizons = useCallback(async () => {
    if (!user || horizons.length > 0) return;

    const defaults = [
      { name: 'Sacred Technology', color: '#38b5b5', sort_order: 0 },
      { name: 'Sanctuary Build', color: '#4a9eff', sort_order: 1 },
      { name: 'Family Support', color: '#9b87f5', sort_order: 2 },
      { name: 'Home Systems', color: '#f59b87', sort_order: 3 },
    ];

    const { data, error } = await supabase
      .from('horizons')
      .insert(defaults.map(h => ({ ...h, user_id: user.id })))
      .select();

    if (error) {
      console.error('Error creating default horizons:', error);
      return;
    }

    if (data && data.length > 0) {
      setHorizons(data);
      setActiveHorizonId(data[0].id);
    }
  }, [user, horizons.length]);

  useEffect(() => {
    if (isLoaded && horizons.length === 0) {
      createDefaultHorizons();
    }
  }, [isLoaded, horizons.length, createDefaultHorizons]);

  const activeHorizon = horizons.find(h => h.id === activeHorizonId);

  const addHorizon = useCallback(async (name: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('horizons')
      .insert({
        user_id: user.id,
        name,
        sort_order: horizons.length,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding horizon:', error);
      toast.error('Failed to create horizon');
      return null;
    }

    setHorizons(prev => [...prev, data]);
    return data;
  }, [user, horizons.length]);

  const updateHorizon = useCallback(async (id: string, updates: Partial<Horizon>) => {
    const { error } = await supabase
      .from('horizons')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating horizon:', error);
      toast.error('Failed to update horizon');
      return;
    }

    setHorizons(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  }, []);

  const archiveHorizon = useCallback(async (id: string) => {
    await updateHorizon(id, { is_active: false });
    setHorizons(prev => prev.filter(h => h.id !== id));
    
    if (activeHorizonId === id) {
      const remaining = horizons.filter(h => h.id !== id);
      if (remaining.length > 0) {
        setActiveHorizonId(remaining[0].id);
      }
    }
  }, [activeHorizonId, horizons, updateHorizon]);

  const addTask = useCallback(async (title: string, horizonId?: string, timeframe?: Timeframe) => {
    if (!user) return null;

    let finalHorizonId = horizonId || lastUsedHorizonRef.current || activeHorizonId;
    let finalTitle = title;
    let dueDate: string | null = null;
    let finalTimeframe: Timeframe = timeframe || 'today';

    // Parse #HorizonName prefix (fuzzy match)
    const prefixMatch = title.match(/^#(\S+)\s+(.+)/);
    if (prefixMatch) {
      const horizonName = prefixMatch[1].toLowerCase();
      const matchedHorizon = horizons.find(h =>
        h.name.toLowerCase().replace(/\s+/g, '') === horizonName ||
        h.name.toLowerCase().replace(/\s+/g, '').includes(horizonName) ||
        h.name.toLowerCase().startsWith(horizonName)
      );
      if (matchedHorizon) {
        finalHorizonId = matchedHorizon.id;
        finalTitle = prefixMatch[2];
      }
    }

    // Parse natural language dates
    const { date, remainingText } = parseDateFromText(finalTitle);
    if (date) {
      dueDate = date.toISOString();
      finalTitle = remainingText;
      finalTimeframe = getTimeframeFromDate(date);
    }

    // Remember last used horizon
    lastUsedHorizonRef.current = finalHorizonId;

    // Optimistic update
    const optimisticTask: Task = {
      id: crypto.randomUUID(),
      horizon_id: finalHorizonId,
      title: finalTitle,
      timeframe: finalTimeframe,
      due_date: dueDate,
      completed: false,
      completed_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => [...prev, optimisticTask]);

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        horizon_id: finalHorizonId,
        title: finalTitle,
        timeframe: finalTimeframe,
        due_date: dueDate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to create task');
      // Rollback optimistic update
      setTasks(prev => prev.filter(t => t.id !== optimisticTask.id));
      return null;
    }

    // Replace optimistic task with real one
    const typedTask = { ...data, timeframe: data.timeframe as Timeframe };
    setTasks(prev => prev.map(t => t.id === optimisticTask.id ? typedTask : t));
    return typedTask;
  }, [user, activeHorizonId, horizons]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    // If due_date is being updated, recalculate timeframe
    const finalUpdates = { ...updates };
    if (updates.due_date !== undefined) {
      const dueDate = updates.due_date ? new Date(updates.due_date) : null;
      finalUpdates.timeframe = getTimeframeFromDate(dueDate);
    }

    // Optimistic update
    const previousTasks = tasks;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...finalUpdates } : t));

    const { error } = await supabase
      .from('tasks')
      .update(finalUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      // Rollback
      setTasks(previousTasks);
      return;
    }
  }, [tasks]);

  const toggleTaskComplete = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;
    const updates = {
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    };

    await updateTask(id, updates);
  }, [tasks, updateTask]);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      return;
    }

    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTasksForHorizon = useCallback((horizonId: string) => {
    return tasks.filter(t => t.horizon_id === horizonId);
  }, [tasks]);

  const getTasksByTimeframe = useCallback((horizonId: string, timeframe: Timeframe) => {
    return tasks.filter(t => t.horizon_id === horizonId && t.timeframe === timeframe);
  }, [tasks]);

  const getTodayTasks = useCallback(() => {
    return tasks.filter(t => t.timeframe === 'today');
  }, [tasks]);

  const visibleHorizons = horizons.filter(h => h.is_active);

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
