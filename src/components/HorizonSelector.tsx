import { cn } from '@/lib/utils';
import { Horizon, ViewMode } from '@/types/horizon';
import { StarIcon } from './StarIcon';
import { Plus, Sparkles, Sun } from 'lucide-react';
import { useState } from 'react';

interface HorizonSelectorProps {
  horizons: Horizon[];
  activeHorizonId: string;
  onSelectHorizon: (id: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddHorizon: (name: string) => void;
  taskCounts: Record<string, number>;
}

export function HorizonSelector({
  horizons,
  activeHorizonId,
  onSelectHorizon,
  viewMode,
  onViewModeChange,
  onAddHorizon,
  taskCounts,
}: HorizonSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAddHorizon(newName.trim());
      setNewName('');
      setIsAdding(false);
    }
  };

  return (
    <nav className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 py-4">
        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => onViewModeChange('horizon')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-body transition-all',
              viewMode === 'horizon'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <StarIcon size="sm" active={viewMode === 'horizon'} />
            Horizon
          </button>
          <button
            onClick={() => onViewModeChange('constellation')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-body transition-all',
              viewMode === 'constellation'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className={cn('w-4 h-4', viewMode === 'constellation' && 'text-star')} />
            Constellation
          </button>
          <button
            onClick={() => onViewModeChange('today')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-body transition-all',
              viewMode === 'today'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sun className={cn('w-4 h-4', viewMode === 'today' && 'text-star')} />
            Today
          </button>
        </div>

        {/* Horizon Tabs */}
        {viewMode === 'horizon' && (
          <div className="flex items-center gap-1 flex-wrap">
            {horizons.map((horizon) => {
              const isActive = horizon.id === activeHorizonId;
              const count = taskCounts[horizon.id] || 0;

              return (
                <button
                  key={horizon.id}
                  onClick={() => onSelectHorizon(horizon.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-display text-lg transition-all',
                    isActive
                      ? 'bg-secondary text-foreground glow-star'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  <StarIcon active={isActive} />
                  <span>{horizon.name}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-xs font-body px-1.5 py-0.5 rounded-full',
                      isActive ? 'bg-star/20 text-star' : 'bg-muted text-muted-foreground'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {isAdding ? (
              <form onSubmit={handleAddSubmit} className="flex items-center">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Horizon name..."
                  className="px-3 py-2 bg-input border border-border rounded-lg text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-star"
                  autoFocus
                  onBlur={() => {
                    if (!newName.trim()) setIsAdding(false);
                  }}
                />
              </form>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-body">Add</span>
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
