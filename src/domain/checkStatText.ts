export interface CheckStatDisplayMeta {
  label: string;
  pointLabel: string;
  icon: string;
}

const CHECK_STAT_META: Record<string, CheckStatDisplayMeta> = {
  strength: { label: '筋力', pointLabel: '筋力点', icon: '💪' },
  dexterity: { label: '器用', pointLabel: '器用点', icon: '🏹' },
  magic: { label: '魔術', pointLabel: '魔術点', icon: '🔮' },
  luck: { label: '幸運', pointLabel: '幸運点', icon: '✨' },
  skill: { label: '技量', pointLabel: '技量点', icon: '🎲' },
  life: { label: '生命', pointLabel: '生命点', icon: '❤️' },
  wisdom: { label: '知恵', pointLabel: '知恵点', icon: '📜' },
};

/**
 * Return the Japanese ability name (e.g. '筋力') for a check stat key.
 */
export function getCheckStatLabel(stat?: string): string {
  if (!stat) return '技量';
  return CHECK_STAT_META[stat]?.label ?? stat.toUpperCase();
}

/**
 * Return the Japanese point label (e.g. '筋力点') for a check stat key.
 */
export function getCheckStatPointLabel(stat?: string): string {
  if (!stat) return '技量点';
  return CHECK_STAT_META[stat]?.pointLabel ?? stat.toUpperCase();
}

/**
 * Return the emoji icon for a check stat key.
 */
export function getCheckStatIcon(stat?: string): string {
  if (!stat) return '🎲';
  return CHECK_STAT_META[stat]?.icon ?? '🎲';
}

/**
 * Build the log message describing which character stat is used for a non-skill/non-life check.
 */
export function buildSubStatCheckLog(
  stat: string,
  statVal: number,
  options: { isSubMatch: boolean; useSubStat: boolean; subStatCurrent: number }
): { text: string; type: 'success' | 'info' | 'error'; usedStatLabel: string; isUsingSubStat: boolean } {
  const reqLabel = getCheckStatLabel(stat);
  const pointLabel = getCheckStatPointLabel(stat);

  if (options.isSubMatch && options.useSubStat) {
    if (options.subStatCurrent > 0) {
      return {
        text: `得意な副能力値【${pointLabel}】を技量点の代わりに使用します。(現在値: ${statVal})`,
        type: 'success',
        usedStatLabel: pointLabel,
        isUsingSubStat: true,
      };
    }
    return {
      text: `副能力値【${pointLabel}】が0点以下のため、技量点で代用して【${reqLabel}】判定を行います。(現在値: ${statVal})`,
      type: 'error',
      usedStatLabel: '技量点',
      isUsingSubStat: false,
    };
  }

  if (options.isSubMatch && !options.useSubStat) {
    return {
      text: `副能力値【${pointLabel}】を使用せず、技量点で代用して【${reqLabel}】判定を行います。(現在値: ${statVal})`,
      type: 'info',
      usedStatLabel: '技量点',
      isUsingSubStat: false,
    };
  }

  return {
    text: `技量点で代用して【${reqLabel}】判定を行います。(現在値: ${statVal})`,
    type: 'info',
    usedStatLabel: '技量点',
    isUsingSubStat: false,
  };
}

/**
 * Format the resolution summary line showing both the required check type and the stat actually used.
 */
export function formatCheckResolutionAbilityLine(
  stat: string | undefined,
  usedStatLabel: string | undefined,
  target: number
): string {
  const reqLabel = getCheckStatLabel(stat);
  const actualUsed = usedStatLabel || getCheckStatPointLabel(stat);
  return `判定能力: ${reqLabel}判定（使用: ${actualUsed} / 目標値: ${target}）`;
}
