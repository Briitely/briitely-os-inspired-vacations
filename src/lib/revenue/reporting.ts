import type { ReportingPeriod } from "./types";

export function getReportingYearStart(year: number, startMonth: number): Date {
  const month = Math.max(1, Math.min(12, startMonth));
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export function getReportingYearEnd(year: number, startMonth: number): Date {
  const start = getReportingYearStart(year, startMonth);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setMilliseconds(-1);
  return end;
}

export function getCurrentReportingYear(startMonth: number): number {
  const now = new Date();
  const year = now.getFullYear();
  if (startMonth > 1 && now.getMonth() < startMonth - 1) {
    return year - 1;
  }
  return year;
}

export function getReportingYearPeriod(startMonth: number): ReportingPeriod {
  const year = getCurrentReportingYear(startMonth);
  return {
    start: getReportingYearStart(year, startMonth),
    end: getReportingYearEnd(year, startMonth),
    label: `${year}`,
  };
}

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function getMonthEnd(date: Date): Date {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  end.setMilliseconds(-1);
  return end;
}

export function getCurrentMonthPeriod(): ReportingPeriod {
  const now = new Date();
  return {
    start: getMonthStart(now),
    end: getMonthEnd(now),
    label: now.toLocaleDateString("en-CA", { month: "long", year: "numeric" }),
  };
}

export function getQuarterStart(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
}

export function getQuarterEnd(date: Date): Date {
  const start = getQuarterStart(date);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  end.setMilliseconds(-1);
  return end;
}

export function getQuarterPeriod(date: Date): ReportingPeriod {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return {
    start: getQuarterStart(date),
    end: getQuarterEnd(date),
    label: `Q${quarter} ${date.getFullYear()}`,
  };
}

export function getCustomPeriod(start: Date, end: Date, label: string): ReportingPeriod {
  return { start, end, label };
}

export function isInPeriod(date: Date, period: ReportingPeriod): boolean {
  return date >= period.start && date <= period.end;
}

export function isInReportingYear(date: Date, startMonth: number): boolean {
  const period = getReportingYearPeriod(startMonth);
  return isInPeriod(date, period);
}

export function isInCurrentMonth(date: Date): boolean {
  const period = getCurrentMonthPeriod();
  return isInPeriod(date, period);
}

export function parseDate(value: string | Date): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}
