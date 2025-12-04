import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Horizon, Timeframe } from '@/types/horizon';

interface TaskInputProps {
  activeHorizon?: Horizon;
  horizons: Horizon[];
  onAddTask: (title: string, horizonId?: string, timeframe?: Timeframe) => void;
}

export function TaskInput({ activeHorizon, horizons, onAddTask }: TaskInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse input for horizon hints
  const getHorizonHint = () => {
    const match = value.match(/^#(\S+)/);
    if (match) {
      const prefix = match[1].toLowerCase();
      const matchedHorizon = horizons.find(h =>
        h.name.toLowerCase().replace(/\s+/g, '').startsWith(prefix) ||
        h.name.toLowerCase().startsWith(prefix)
      );
      if (matchedHorizon && matchedHorizon.id !== activeHorizon?.id) {
        return matchedHorizon.name;
      }
    }
    return null;
  };

  const horizonHint = getHorizonHint();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAddTask(value.trim());
      setValue('');
    }
  };

  // Keyboard shortcut to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isFocused && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused]);

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={cn(
          'relative rounded-xl transition-all duration-300',
          isFocused ? 'shadow-card' : ''
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={activeHorizon ? `Add to ${activeHorizon.name}... (or use #HorizonName)` : 'Add a task...'}
          className={cn(
            'w-full px-5 py-4 bg-card border border-border/50 rounded-xl',
            'font-body text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:border-star/50 focus:ring-1 focus:ring-star/20',
            'transition-all duration-300'
          )}
        />
        
        {/* Keyboard hint */}
        {!isFocused && !value && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
            <kbd className="px-2 py-0.5 text-xs bg-secondary rounded border border-border font-mono">
              /
            </kbd>
          </div>
        )}

        {/* Horizon routing hint */}
        {horizonHint && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <span className="px-2 py-1 text-xs bg-star/20 text-star rounded-md font-body">
              → {horizonHint}
            </span>
          </div>
        )}
      </div>
    </form>
  );
}
