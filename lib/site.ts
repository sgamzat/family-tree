/** Название села из настройки VILLAGE_NAME (.env). Пока не задано — просто «Древо села». */
export function villageName(): string | null {
  const value = process.env.VILLAGE_NAME?.trim();
  return value ? value : null;
}
