export const eur = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

export const dateTime = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "–";

export const relDays = (d: string | null | undefined) => {
  if (!d) return "–";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days === 0 ? "heute" : days === 1 ? "gestern" : `vor ${days} Tagen`;
};
