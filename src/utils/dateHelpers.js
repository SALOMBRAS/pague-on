function startOfUtcDay(value = new Date()) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function endOfUtcDay(value = new Date()) {
  const date = startOfUtcDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCMilliseconds(-1);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function addMonths(value, months) {
  const source = new Date(value);
  const day = source.getUTCDate();
  const result = new Date(source);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function nextDueDate(value, frequency) {
  const days = { WEEKLY: 7, BIWEEKLY: 14 };
  const months = {
    MONTHLY: 1,
    BIMONTHLY: 2,
    QUARTERLY: 3,
    SEMIANNUAL: 6,
    ANNUAL: 12,
  };
  if (days[frequency]) return addDays(value, days[frequency]);
  if (months[frequency]) return addMonths(value, months[frequency]);
  return new Date(value);
}

function recurringPeriod(date, frequency) {
  const value = new Date(date);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  if (frequency === 'QUARTERLY') return `${year}-Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
  if (frequency === 'SEMIANNUAL') return `${year}-S${value.getUTCMonth() < 6 ? 1 : 2}`;
  if (frequency === 'ANNUAL') return String(year);
  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    const firstDay = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((value - firstDay) / 86400000) + firstDay.getUTCDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  return `${year}-${month}`;
}

function greetingFor(date = new Date()) {
  const hour = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23',
  }).format(date);
  const numericHour = Number(hour);
  if (numericHour < 12) return 'Bom dia ☀️';
  if (numericHour < 18) return 'Boa tarde 🌤️';
  return 'Boa noite 🌙';
}

function weekdayLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' })
    .format(date)
    .replace('.', '')
    .replace(/^./, (letter) => letter.toUpperCase());
}

module.exports = {
  startOfUtcDay,
  endOfUtcDay,
  addDays,
  addMonths,
  nextDueDate,
  recurringPeriod,
  greetingFor,
  weekdayLabel,
};
