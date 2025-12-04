export type Timeframe = 'today' | 'week' | 'backlog';

export interface Task {
  id: string;
  title: string;
  horizonId: string;
  timeframe: Timeframe;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface Horizon {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  taskCount?: number;
}

export type ViewMode = 'horizon' | 'constellation' | 'today';
