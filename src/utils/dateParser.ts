import { addDays, addWeeks, nextMonday, nextFriday, startOfTomorrow, setHours, setMinutes, parse, isValid } from 'date-fns';

export interface ParsedDate {
  date: Date | null;
  remainingText: string;
}

const datePatterns: Array<{ pattern: RegExp; resolver: (match: RegExpMatchArray) => Date }> = [
  // "tomorrow"
  { pattern: /\btomorrow\b/i, resolver: () => startOfTomorrow() },
  
  // "today"
  { pattern: /\btoday\b/i, resolver: () => new Date() },
  
  // "next week"
  { pattern: /\bnext\s+week\b/i, resolver: () => nextMonday(new Date()) },
  
  // "next monday", "next friday", etc.
  { 
    pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, 
    resolver: (match) => {
      const dayName = match[1].toLowerCase();
      const dayMap: Record<string, number> = { 
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, 
        thursday: 4, friday: 5, saturday: 6 
      };
      const targetDay = dayMap[dayName];
      let date = new Date();
      const currentDay = date.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      return addDays(date, daysUntilTarget === 0 ? 7 : daysUntilTarget);
    }
  },
  
  // "in X days"
  { 
    pattern: /\bin\s+(\d+)\s+days?\b/i, 
    resolver: (match) => addDays(new Date(), parseInt(match[1], 10)) 
  },
  
  // "in X weeks"
  { 
    pattern: /\bin\s+(\d+)\s+weeks?\b/i, 
    resolver: (match) => addWeeks(new Date(), parseInt(match[1], 10)) 
  },
  
  // "friday", "monday" etc. (this week or next)
  { 
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, 
    resolver: (match) => {
      const dayName = match[1].toLowerCase();
      const dayMap: Record<string, number> = { 
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, 
        thursday: 4, friday: 5, saturday: 6 
      };
      const targetDay = dayMap[dayName];
      let date = new Date();
      const currentDay = date.getDay();
      let daysUntilTarget = (targetDay - currentDay + 7) % 7;
      if (daysUntilTarget === 0) daysUntilTarget = 7; // If today is that day, assume next week
      return addDays(date, daysUntilTarget);
    }
  },
  
  // "MM/DD" or "M/D"
  { 
    pattern: /\b(\d{1,2})\/(\d{1,2})\b/, 
    resolver: (match) => {
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      const date = new Date();
      date.setMonth(month, day);
      // If date is in the past, assume next year
      if (date < new Date()) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }
  },
  
  // "end of week"
  { pattern: /\bend\s+of\s+week\b/i, resolver: () => nextFriday(new Date()) },
];

export function parseDateFromText(text: string): ParsedDate {
  for (const { pattern, resolver } of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = resolver(match);
      // Set to end of day for due dates
      date.setHours(23, 59, 59, 999);
      const remainingText = text.replace(pattern, '').trim().replace(/\s+/g, ' ');
      return { date, remainingText };
    }
  }
  
  return { date: null, remainingText: text };
}

export function getTimeframeFromDate(dueDate: Date | null): 'today' | 'week' | 'backlog' {
  if (!dueDate) return 'backlog';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = addDays(today, 7 - today.getDay()); // End of current week (Sunday)
  
  if (dueDate <= addDays(today, 1)) {
    return 'today';
  } else if (dueDate <= endOfWeek) {
    return 'week';
  }
  return 'backlog';
}
