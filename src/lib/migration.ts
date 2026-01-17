// Terminology 마이그레이션 (v1 → v2)
// Old: { knit, crochet, rules, multilang } (hardcoded categories)
// New: { version, categories, globalRules, knowledgeMemory } (dynamic categories)

import type { Terminology, ContentCategory } from '../types/channel';
import { KNITTING_PRESET_CATEGORIES } from '../types/channel';

// 현재 버전
export const CURRENT_VERSION = 2;

// Old format 타입 정의 (마이그레이션용)
interface OldTermCategory {
  [korean: string]: string;
}

interface OldTranslationRule {
  pattern: string;
  replacement: string;
  description?: string;
}

interface OldTerminology {
  knit: OldTermCategory;
  crochet: OldTermCategory;
  rules?: OldTranslationRule[];
  disabledRules?: string[];
  multilang?: any;
}

/**
 * 구 버전 포맷인지 확인
 * (knit/crochet 속성 존재 && version 속성 없음)
 */
export function isOldFormat(data: any): boolean {
  return (
    data &&
    typeof data === 'object' &&
    'knit' in data &&
    'crochet' in data &&
    !('version' in data) &&
    !('categories' in data)
  );
}

/**
 * 구 버전 → 신 버전으로 마이그레이션
 */
export function migrateTerminology(oldData: any): Terminology {
  if (!isOldFormat(oldData)) {
    // 이미 새 포맷이거나 유효하지 않은 데이터
    console.warn('Not old format, returning default new structure');
    return getDefaultNewTerminology();
  }

  const old = oldData as OldTerminology;
  const now = new Date();

  // 1. knit 카테고리 변환
  const knitCategory: ContentCategory = {
    id: 'knit',
    name: '대바늘',
    icon: '🧶',
    terminology: { ...old.knit }, // 기존 용어 복사
    contextHints: [], // 구 버전에는 카테고리별 맥락힌트 없음
    createdAt: now,
  };

  // 2. crochet 카테고리 변환
  const crochetCategory: ContentCategory = {
    id: 'crochet',
    name: '코바늘',
    icon: '🪢',
    terminology: { ...old.crochet }, // 기존 용어 복사
    contextHints: [],
    createdAt: now,
  };

  // 3. globalRules 변환 (구 버전의 rules를 전역 규칙으로)
  const globalRules = (old.rules || []).map(rule => ({
    pattern: rule.pattern,
    replacement: rule.replacement,
    description: rule.description,
  }));

  // 4. 새 구조로 변환
  return {
    version: CURRENT_VERSION,
    categories: {
      knit: knitCategory,
      crochet: crochetCategory,
    },
    globalRules,
    knowledgeMemory: [], // 구 버전에는 지식 메모리 없음
  };
}

/**
 * 기본 새 버전 Terminology 반환
 * (빈 구조 + 기본 뜨개질 카테고리)
 */
export function getDefaultNewTerminology(): Terminology {
  const now = new Date();

  // 기본 카테고리 (knit, crochet) 생성
  const categories: Record<string, ContentCategory> = {};

  Object.entries(KNITTING_PRESET_CATEGORIES).forEach(([id, preset]) => {
    categories[id] = {
      id,
      name: preset.name,
      icon: preset.icon,
      terminology: { ...preset.terminology },
      contextHints: [...preset.contextHints],
      createdAt: now,
    };
  });

  return {
    version: CURRENT_VERSION,
    categories,
    globalRules: [],
    knowledgeMemory: [],
  };
}

/**
 * 로컬 스토리지에서 로드 + 자동 마이그레이션
 */
export function loadAndMigrateTerminology(storageKey: string): Terminology {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return getDefaultNewTerminology();
    }

    const data = JSON.parse(stored);

    // 구 버전이면 마이그레이션
    if (isOldFormat(data)) {
      console.log('Migrating from old terminology format...');
      const migrated = migrateTerminology(data);
      // 마이그레이션 후 바로 저장
      localStorage.setItem(storageKey, JSON.stringify(migrated));
      return migrated;
    }

    // 이미 새 버전
    return data as Terminology;
  } catch (e) {
    console.error('Failed to load/migrate terminology:', e);
    return getDefaultNewTerminology();
  }
}

/**
 * Terminology 버전 확인
 */
export function getTerminologyVersion(data: any): number {
  if (isOldFormat(data)) {
    return 1;
  }
  return data?.version || CURRENT_VERSION;
}
