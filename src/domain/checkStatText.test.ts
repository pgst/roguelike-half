import { describe, it, expect } from 'vitest';
import {
  getCheckStatLabel,
  getCheckStatPointLabel,
  getCheckStatIcon,
  buildSubStatCheckLog,
  formatCheckResolutionAbilityLine,
} from './checkStatText';

describe('checkStatText', () => {
  it('maps check stat keys to consistent Japanese labels and icons', () => {
    expect(getCheckStatLabel('strength')).toBe('筋力');
    expect(getCheckStatPointLabel('strength')).toBe('筋力点');
    expect(getCheckStatIcon('strength')).toBe('💪');

    expect(getCheckStatLabel('dexterity')).toBe('器用');
    expect(getCheckStatLabel('magic')).toBe('魔術');
    expect(getCheckStatLabel('luck')).toBe('幸運');
    expect(getCheckStatLabel('skill')).toBe('技量');
    expect(getCheckStatLabel('life')).toBe('生命');
  });

  it('builds consistent log messages when substituting skill for a required sub-stat', () => {
    const mismatch = buildSubStatCheckLog('strength', 0, {
      isSubMatch: false,
      useSubStat: true,
      subStatCurrent: 2,
    });
    expect(mismatch.usedStatLabel).toBe('技量点');
    expect(mismatch.isUsingSubStat).toBe(false);
    expect(mismatch.text).toBe('技量点で代用して【筋力】判定を行います。(現在値: 0)');

    const depleted = buildSubStatCheckLog('strength', 1, {
      isSubMatch: true,
      useSubStat: true,
      subStatCurrent: 0,
    });
    expect(depleted.usedStatLabel).toBe('技量点');
    expect(depleted.text).toBe('副能力値【筋力点】が0点以下のため、技量点で代用して【筋力】判定を行います。(現在値: 1)');

    const usingSub = buildSubStatCheckLog('strength', 3, {
      isSubMatch: true,
      useSubStat: true,
      subStatCurrent: 3,
    });
    expect(usingSub.usedStatLabel).toBe('筋力点');
    expect(usingSub.isUsingSubStat).toBe(true);
    expect(usingSub.text).toBe('得意な副能力値【筋力点】を技量点の代わりに使用します。(現在値: 3)');
  });

  it('formats resolution ability line with both required check and used stat', () => {
    expect(formatCheckResolutionAbilityLine('strength', '技量点', 4)).toBe(
      '判定能力: 筋力判定（使用: 技量点 / 目標値: 4）'
    );
    expect(formatCheckResolutionAbilityLine('strength', '筋力点', 4)).toBe(
      '判定能力: 筋力判定（使用: 筋力点 / 目標値: 4）'
    );
  });
});
