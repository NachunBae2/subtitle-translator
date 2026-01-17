// 용어 사전 프리셋 인덱스
// 새로운 프리셋 추가 시 여기에 등록

import { Terminology } from '../../lib/terminology';
import { KNITTING_PRESET, KNITTING_PRESET_INFO } from './knitting';

export interface PresetInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  termCount: number;
}

export interface Preset {
  info: PresetInfo;
  terminology: Terminology;
}

// 사용 가능한 프리셋 목록
export const PRESETS: Preset[] = [
  {
    info: KNITTING_PRESET_INFO,
    terminology: KNITTING_PRESET,
  },
  // 추후 다른 장르 프리셋 추가 가능:
  // { info: COOKING_PRESET_INFO, terminology: COOKING_PRESET },
  // { info: GAMING_PRESET_INFO, terminology: GAMING_PRESET },
];

// ID로 프리셋 가져오기
export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find(p => p.info.id === id);
}

// 프리셋 용어를 기존 용어사전에 병합
export function mergePreset(current: Terminology, preset: Terminology): Terminology {
  return {
    terms: { ...current.terms, ...preset.terms },
    rules: current.rules || [],
    multilang: current.multilang,
  };
}
