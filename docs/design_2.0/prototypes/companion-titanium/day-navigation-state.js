const DAY_MS = 86_400_000;

const isoDay = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null;
};

export const shiftIsoDay = (date, amount) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);

export function createDayNavigation(todayDate, initialDate = todayDate) {
  const today = isoDay(todayDate);
  if (!today) throw new Error('A mai naphoz érvényes ISO-dátum kell.');
  let selected = isoDay(initialDate) && initialDate <= today ? initialDate : today;

  return {
    get date() { return selected; },
    get max() { return today; },
    select(date) {
      if (!isoDay(date) || date > today || date === selected) return false;
      selected = date;
      return true;
    },
    shift(amount) {
      if (!Number.isInteger(amount) || amount === 0) return false;
      const next = shiftIsoDay(selected, amount);
      if (next > today) return false;
      selected = next;
      return true;
    },
    today() {
      if (selected === today) return false;
      selected = today;
      return true;
    },
  };
}

export const dayRoute = (domain, page, detail = '') =>
  !detail && ((domain === 'me' && [1, 2, 3].includes(page)) ||
    ((domain === 'fuel' || domain === 'train') && page === 0));

export function swipeDayDelta({ startX, endX, startY, endY }, threshold = 52) {
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

export function dayDescriptor(date, today) {
  const difference = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / DAY_MS);
  const eyebrow = difference === 0 ? 'MA' : difference === 1 ? 'TEGNAP' : `${difference} NAPPAL EZELŐTT`;
  const label = new Intl.DateTimeFormat('hu-HU', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
  return { eyebrow, label, isToday: difference === 0 };
}
