export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function primerDiaMesISO(): string {
  return `${hoyISO().slice(0, 8)}01`;
}
