export function addCalendarDaysRollingWeekend(days: number, from: Date = new Date()): string {
  const due = new Date(from);
  due.setDate(due.getDate() + days);

  if (due.getDay() === 6) {
    due.setDate(due.getDate() + 2);
  } else if (due.getDay() === 0) {
    due.setDate(due.getDate() + 1);
  }

  return due.toISOString();
}
