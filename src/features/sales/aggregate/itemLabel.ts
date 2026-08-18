// 품목 표시 라벨 우선순위 — 순수 함수 (I/O 없음).
// 사용자 별칭 > 원본 제품명(itemLabels) > 원본 키. 두 표(품목별·일별 품목별 피벗)가 공유한다.

export function resolveItemLabel(
  key: string,
  aliases: Record<string, string> | undefined,
  itemLabels: Record<string, string> | undefined,
): string {
  const alias = aliases?.[key];
  if (alias && alias.trim() !== '') return alias;
  return itemLabels?.[key] || key;
}
