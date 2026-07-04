export class DateHelpers {
  static getLocalStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  static toISODateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static parseISODate(str: string | null | undefined): Date | null {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  static isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  static isToday(date: Date): boolean {
    return this.isSameDay(date, new Date());
  }

  static addDays(date: Date, n: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  static addMonths(date: Date, n: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  static startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  static mondayFirstWeekdayIndex(date: Date): number {
    // JS getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    // We want: 0 = Mon, 1 = Tue, ..., 6 = Sun
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }

  static startOfWeek(date: Date, weekStartsMonday: boolean = true): Date {
    const day = this.getLocalStartOfDay(date);
    const index = date.getDay(); // 0 = Sun, 1 = Mon ...
    let delta = 0;
    if (weekStartsMonday) {
      delta = this.mondayFirstWeekdayIndex(day);
    } else {
      delta = index; // 0 for Sun, 1 for Mon ...
    }
    return this.addDays(day, -delta);
  }

  static week(containing: Date, weekStartsMonday: boolean = true): Date[] {
    const start = this.startOfWeek(containing, weekStartsMonday);
    return Array.from({ length: 7 }, (_, i) => this.addDays(start, i));
  }

  static monthGrid(date: Date, weekStartsMonday: boolean = true): (Date | null)[] {
    const start = this.startOfMonth(date);
    
    // Find next month to get total days
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const timeDiff = nextMonth.getTime() - start.getTime();
    const dayCount = Math.round(timeDiff / (1000 * 60 * 60 * 24));

    const firstWeekday = start.getDay(); // 0 = Sun
    let leadingBlanks = 0;
    if (weekStartsMonday) {
      leadingBlanks = this.mondayFirstWeekdayIndex(start);
    } else {
      leadingBlanks = firstWeekday;
    }

    const blanks: (Date | null)[] = Array(leadingBlanks).fill(null);
    const days: (Date | null)[] = Array.from({ length: dayCount }, (_, i) => this.addDays(start, i));

    return [...blanks, ...days];
  }

  static weekdayHeaderSymbols(weekStartsMonday: boolean = true): string[] {
    return weekStartsMonday
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  }

  // Format templates matching Swift helpers
  static format(date: Date, formatStr: string): string {
    const locale = 'default';
    if (formatStr === 'EEE MMM d') {
      // e.g. "Fri, Jun 13"
      const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
      const month = date.toLocaleDateString(locale, { month: 'short' });
      const day = date.getDate();
      return `${weekday}, ${month} ${day}`;
    }
    if (formatStr === 'EEEE MMM d') {
      // e.g. "Friday, Jun 13"
      const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
      const month = date.toLocaleDateString(locale, { month: 'short' });
      const day = date.getDate();
      return `${weekday}, ${month} ${day}`;
    }
    if (formatStr === 'MMMM yyyy') {
      // e.g. "June 2026"
      const month = date.toLocaleDateString(locale, { month: 'long' });
      const year = date.getFullYear();
      return `${month} ${year}`;
    }
    // Fallback
    return date.toLocaleDateString();
  }

  static medium(date: Date): string {
    return this.format(date, 'EEE MMM d');
  }

  static long(date: Date): string {
    return this.format(date, 'EEEE MMM d');
  }

  static monthYear(date: Date): string {
    return this.format(date, 'MMMM yyyy');
  }
}
