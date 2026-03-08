export function getQuizMinutes(count) {
  return Math.max(1, Math.ceil(Number(count || 0) * 1.5));
}

export function formatTime(seconds) {
  const s = Math.max(0, Number(seconds || 0));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
