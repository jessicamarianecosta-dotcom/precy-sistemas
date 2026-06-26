import { addDays, addWeeks, addMonths, addYears } from 'date-fns'

export function nextDueFrom(date: Date, periodicity: string): Date {
  switch (periodicity) {
    case 'weekly':   return addWeeks(date, 1)
    case 'biweekly': return addDays(date, 14)
    case 'yearly':   return addYears(date, 1)
    default:         return addMonths(date, 1)
  }
}
