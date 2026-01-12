import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Zap, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Capture() {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCapture = async () => {
    if (!text.trim()) {
      toast.error('Please enter something to capture');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to capture');
        return;
      }

      const response = await supabase.functions.invoke('taskade-capture', {
        body: { text: text.trim() }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to capture');
      }

      toast.success('Captured successfully!');
      setText('');
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCapture();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link 
            to="/" 
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Quick Capture</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Capture thoughts, ideas, tasks — anything on your mind
            </p>
          </div>

          <div className="space-y-4">
            <Textarea
              placeholder="What's on your mind?"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[200px] text-base resize-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="text-sm text-muted-foreground">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⌘</kbd>
                {' + '}
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">Enter</kbd>
                {' to capture quickly'}
              </p>

              <Button
                onClick={handleCapture}
                disabled={isSubmitting || !text.trim()}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Capture
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
