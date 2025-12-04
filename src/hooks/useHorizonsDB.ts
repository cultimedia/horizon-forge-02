import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

  // Initial load
  useEffect(() => {
    if (user) {
      Promise.all([fetchHorizons(), fetchTasks()]).then(() => {
        setIsLoaded(true);
      });
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

  const addTask = useCallback(async (title: string, horizonId?: string, timeframe: Timeframe = 'today') => {
    if (!user) return null;

    let finalHorizonId = horizonId || activeHorizonId;
    let finalTitle = title;

    // Parse #HorizonName prefix
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

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        horizon_id: finalHorizonId,
        title: finalTitle,
        timeframe,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to create task');
      return null;
    }

    const typedTask = { ...data, timeframe: data.timeframe as Timeframe };
    setTasks(prev => [...prev, typedTask]);
    return typedTask;
  }, [user, activeHorizonId, horizons]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      return;
    }

    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

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
