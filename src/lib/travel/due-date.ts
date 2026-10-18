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

/** Add working days (Monday-Friday), excluding the start date. */
export function addBusinessDays(days: number, from: Date = new Date()): string {
  const due = new Date(from);
  for (let remaining = days; remaining > 0;) {
    due.setDate(due.getDate() + 1);
    if (due.getDay() !== 0 && due.getDay() !== 6) remaining--;
  }
  return due.toISOString();
}
