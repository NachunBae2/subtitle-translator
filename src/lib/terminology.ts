// 용어 사전 (전문용어) 관리

export interface TermCategory {
  [korean: string]: string;  // 한국어 → 영어
}

// 번역 지침 (custom rules)
// 예: "히) => H)", "겉뜨기 x3 => K3"
export interface TranslationRule {
  pattern: string;     // 변환할 패턴 (한국어)
  replacement: string; // 변환 결과 (영어)
  description?: string; // 설명 (옵션)
}

// 다국어 용어 (영어 → 각 언어)
export interface MultiLangTermCategory {
  [english: string]: string;  // 영어 → 대상 언어
}

export interface MultiLangTerminology {
  [langCode: string]: MultiLangTermCategory;  // 언어코드별 용어 사전
}

export interface Terminology {
  terms: TermCategory;       // 용어 사전 (한→영)
  rules?: TranslationRule[]; // 커스텀 번역 규칙
  disabledRules?: string[];  // 비활성화된 기본 규칙 패턴
  multilang?: MultiLangTerminology;  // 다국어 (영→각 언어)
}

// 레거시 구조 (마이그레이션용)
interface LegacyTerminology {
  knit?: TermCategory;
  crochet?: TermCategory;
  terms?: TermCategory;
  rules?: TranslationRule[];
  disabledRules?: string[];
  multilang?: MultiLangTerminology;
}

// 기본 번역 규칙 (없음 - 사용자가 직접 추가)
export const DEFAULT_RULES: TranslationRule[] = [];

// 기본 용어 사전 (빈 사전 - 프리셋으로 로드 가능)
export const DEFAULT_TERMINOLOGY: Terminology = {
  terms: {},
};

// 기본 용어 사전 반환
export function getDefaultTerminology(): Terminology {
  return { ...DEFAULT_TERMINOLOGY };
}

// 로컬 스토리지 키
const STORAGE_KEY = 'subtitle-translator-terminology';

// 레거시 데이터 마이그레이션
function migrateTerminology(data: LegacyTerminology): Terminology {
  // 이미 새 구조면 그대로 반환
  if (data.terms && !data.knit && !data.crochet) {
    return data as Terminology;
  }

  // 레거시 구조 (knit/crochet) → 새 구조 (terms)
  const terms: TermCategory = {
    ...(data.knit || {}),
    ...(data.crochet || {}),
    ...(data.terms || {}),
  };

  return {
    terms,
    rules: data.rules,
    disabledRules: data.disabledRules,
    multilang: data.multilang,
  };
}

// 용어 사전 로드
export function loadTerminology(): Terminology {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateTerminology(parsed);
    }
  } catch (e) {
    console.error('Failed to load terminology:', e);
  }
  return DEFAULT_TERMINOLOGY;
}

// 용어 사전 저장
export function saveTerminology(terminology: Terminology): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(terminology));
  } catch (e) {
    console.error('Failed to save terminology:', e);
  }
}

// 용어 추가
export function addTerm(
  terminology: Terminology,
  korean: string,
  english: string
): Terminology {
  return {
    ...terminology,
    terms: {
      ...terminology.terms,
      [korean]: english,
    },
  };
}

// 용어 삭제
export function removeTerm(
  terminology: Terminology,
  korean: string
): Terminology {
  const newTerms = { ...terminology.terms };
  delete newTerms[korean];
  return {
    ...terminology,
    terms: newTerms,
  };
}

// 용어 사전 초기화
export function resetTerminology(): Terminology {
  saveTerminology(DEFAULT_TERMINOLOGY);
  return DEFAULT_TERMINOLOGY;
}

// JSON 내보내기
export function exportTerminology(terminology: Terminology): string {
  return JSON.stringify(terminology, null, 2);
}

// JSON 가져오기
export function importTerminology(json: string): Terminology {
  const parsed = JSON.parse(json);
  // 레거시/새 구조 모두 지원
  return migrateTerminology(parsed);
}

// 번역 규칙 추가
export function addRule(
  terminology: Terminology,
  pattern: string,
  replacement: string,
  description?: string
): Terminology {
  const rules = terminology.rules || [];
  // 중복 체크
  if (rules.some(r => r.pattern === pattern)) {
    return terminology;
  }
  return {
    ...terminology,
    rules: [...rules, { pattern, replacement, description }],
  };
}

// 번역 규칙 삭제
export function removeRule(terminology: Terminology, pattern: string): Terminology {
  if (!terminology.rules) return terminology;
  return {
    ...terminology,
    rules: terminology.rules.filter(r => r.pattern !== pattern),
  };
}

// 모든 번역 규칙 가져오기
export function getAllRules(terminology: Terminology): TranslationRule[] {
  return terminology.rules || [];
}

// 번역 규칙을 프롬프트용 텍스트로 변환 (맥락 기반)
export function rulesToPromptText(terminology: Terminology): string {
  const rules = getAllRules(terminology);
  if (rules.length === 0) return '';

  const rulesList = rules
    .map(r => `- "${r.pattern}" → "${r.replacement}"`)
    .join('\n');

  return `## Channel-Specific Expressions (밈/내부 용어)

The YouTuber has defined these channel-specific expressions that their audience recognizes.
These are NOT literal translations - they are community "memes" or shorthand that have specific meanings in this channel's context.

${rulesList}

### How to handle these:

1. **Understand intent**: These expressions are often:
   - Nicknames for the creator or mascots (e.g., "히)" = short for "히요정" fairy character → "H)")
   - Community inside jokes
   - Shortened forms of longer phrases

2. **Context matters**:
   - Only apply when the expression is used INDEPENDENTLY with its intended meaning
   - Do NOT apply if the characters happen to appear as part of another word
   - Example: "히)" as a standalone greeting → "H)", but "안녕히" → "goodbye" (not "안녕H")

3. **Natural translation**:
   - The goal is for international viewers to recognize the same "vibe" as Korean viewers
   - If unsure, prioritize natural English over forced pattern matching`;
}

// 다국어 용어 추가
export function addMultiLangTerm(
  terminology: Terminology,
  langCode: string,
  english: string,
  translation: string
): Terminology {
  const multilang = terminology.multilang || {};
  const langTerms = multilang[langCode] || {};

  return {
    ...terminology,
    multilang: {
      ...multilang,
      [langCode]: {
        ...langTerms,
        [english]: translation,
      },
    },
  };
}

// 다국어 용어 삭제
export function removeMultiLangTerm(
  terminology: Terminology,
  langCode: string,
  english: string
): Terminology {
  if (!terminology.multilang?.[langCode]) return terminology;

  const langTerms = { ...terminology.multilang[langCode] };
  delete langTerms[english];

  return {
    ...terminology,
    multilang: {
      ...terminology.multilang,
      [langCode]: langTerms,
    },
  };
}

// 특정 언어의 용어 가져오기
export function getMultiLangTerms(
  terminology: Terminology,
  langCode: string
): MultiLangTermCategory {
  return terminology.multilang?.[langCode] || {};
}
