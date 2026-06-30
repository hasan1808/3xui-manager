import { toJalaali } from "jalaali-js";

const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export function formatPersianDate(date: Date | string | number, options?: { time?: boolean }): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const monthName = PERSIAN_MONTHS[jm - 1];
  let result = `${jd} ${monthName} ${jy}`;
  if (options?.time) {
    result += ` ساعت ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return result;
}

export function formatPersianDateShort(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${jy}/${jm.toString().padStart(2, "0")}/${jd.toString().padStart(2, "0")}`;
}

export function formatPersianTime(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

export function formatPersianDateTime(date: Date | string | number): string {
  return formatPersianDate(date, { time: true });
}
