export const BUSINESS_CATEGORIES = [
  "Jasa kreatif",
  "Jasa Drone",
  "Properti",
  "Konsultan",
  "Retail",
  "Kuliner",
  "Pendidikan",
  "Kesehatan",
  "Teknologi",
  "Lainnya",
] as const;

export function businessCategoryOptions(current: string) {
  return current && !BUSINESS_CATEGORIES.some(category => category === current)
    ? [current, ...BUSINESS_CATEGORIES]
    : BUSINESS_CATEGORIES;
}
