// 채널 프로필 & 범용화 타입 정의

// 채널 프로필 - 유튜버 맥락 정보
export interface ChannelProfile {
  id: string;
  name: string;                  // 채널명
  targetAudience: string;        // 시청자층
  contentStyle: string;          // 콘텐츠 스타일
  speakingTone: string;          // 말투
  specialNotes: string;          // 번역 주의사항
  customSystemPrompt: string;    // GPT 생성 System Prompt
  createdAt: Date;
  updatedAt: Date;
}

// 콘텐츠 카테고리 (동적, 사용자 정의)
export interface ContentCategory {
  id: string;
  name: string;                  // 카테고리명 (예: "대바늘", "코바늘", "요리")
  icon?: string;                 // 이모지 (예: "🧶", "🪢", "🍳")
  terminology: Record<string, string>;  // 전문용어 (한국어 → 영어)
  contextHints: TranslationRule[];      // 맥락힌트
  createdAt: Date;
}

// 번역 규칙 (맥락힌트)
export interface TranslationRule {
  pattern: string;     // 변환할 패턴 (한국어)
  replacement: string; // 변환 결과 (영어)
  description?: string; // 설명 (옵션)
}

// 지식 메모리 - 사용자가 직접 입력하는 피드백
export interface KnowledgeMemory {
  id: string;
  pattern: string;               // 자주 틀리는 패턴
  feedback: string;              // 피드백/수정 방향
  examples: string[];            // 예시
  isActive: boolean;             // 번역 시 사용 여부
  createdAt: Date;
}

// 용어사전 - 새 구조 (동적 카테고리)
export interface Terminology {
  version: number;               // 마이그레이션용 버전
  categories: Record<string, ContentCategory>;  // 카테고리별 용어
  globalRules: TranslationRule[];              // 전역 맥락힌트
  knowledgeMemory: KnowledgeMemory[];          // 지식 메모리
}

// 대시보드 통계
export interface TranslationStats {
  totalSubtitles: number;          // 총 번역한 자막 파일 수
  totalSentences: number;          // 총 번역한 문장 수
  totalWords: number;              // 총 번역한 단어 수
  languageDistribution: Record<string, number>;  // 언어별 번역 수
  dailyActivity: Record<string, number>;  // 날짜별 활동 (YYYY-MM-DD: count)
  badges: Badge[];                 // 획득한 뱃지
  estimatedTimeSaved: number;      // 절약한 시간 (분)
  lastTranslationDate?: string;    // 마지막 번역 날짜
}

// 뱃지
export interface Badge {
  id: string;
  name: string;                    // "100문장 돌파!"
  icon: string;                    // 🏆
  description: string;             // 설명
  unlockedAt?: Date;               // 획득 시간 (없으면 미획득)
}

// 뱃지 정의 (상수)
export const BADGE_DEFINITIONS: Omit<Badge, 'unlockedAt'>[] = [
  { id: 'first-translation', name: '첫 번역!', icon: '🎯', description: '첫 번째 자막 번역 완료' },
  { id: 'multilang-first', name: '다국어 도전', icon: '🌍', description: '첫 다국어 번역 완료' },
  { id: 'sentences-100', name: '100문장 돌파', icon: '💯', description: '100문장 번역 달성' },
  { id: 'sentences-500', name: '500문장 달성', icon: '🚀', description: '500문장 번역 달성' },
  { id: 'sentences-1000', name: '1000문장 마스터', icon: '👑', description: '1000문장 번역 달성' },
  { id: 'streak-3', name: '3일 연속', icon: '🔥', description: '3일 연속 번역' },
  { id: 'streak-7', name: '7일 연속', icon: '🔥🔥', description: '7일 연속 번역' },
  { id: 'streak-30', name: '30일 연속', icon: '⚡', description: '30일 연속 번역' },
  { id: 'files-10', name: '파일 10개', icon: '📁', description: '10개 파일 번역 완료' },
  { id: 'files-50', name: '파일 50개', icon: '📚', description: '50개 파일 번역 완료' },
];

// 기본 카테고리 프리셋 (뜨개질 - 기존 사용자 호환)
export const KNITTING_PRESET_CATEGORIES: Record<string, Omit<ContentCategory, 'id' | 'createdAt'>> = {
  knit: {
    name: '대바늘',
    icon: '🧶',
    terminology: {
      '게이지': 'gauge',
      '코': 'stitch',
      '단': 'row',
      '실': 'yarn',
      '겉뜨기': 'knit',
      '안뜨기': 'purl',
      '걸러뜨기': 'slip',
      '코 줍기': 'pick up',
      '코 잡기': 'cast on',
      '코 막기': 'cast off',
      '겉면': 'right side',
      '뒷면': 'wrong side',
      '메리야스 뜨기': 'stockinette stitch',
      '고무 뜨기': 'ribbing',
      '늘림코': 'increase',
      '줄임코': 'decrease',
      '대바늘': 'knitting needle',
    },
    contextHints: [],
  },
  crochet: {
    name: '코바늘',
    icon: '🪢',
    terminology: {
      '코': 'stitch',
      '단': 'round',
      '코바늘': 'crochet hook',
      '실': 'yarn',
      '사슬뜨기': 'chain stitch',
      '짧은뜨기': 'single crochet',
      '긴뜨기': 'double crochet',
      '한길긴뜨기': 'half double crochet',
      '빼뜨기': 'slip stitch',
      '늘림코': 'increase',
      '줄임코': 'decrease',
      '고리만들기': 'magic ring',
      '인형': 'amigurumi',
    },
    contextHints: [],
  },
};

// 기본 통계
export const DEFAULT_STATS: TranslationStats = {
  totalSubtitles: 0,
  totalSentences: 0,
  totalWords: 0,
  languageDistribution: {},
  dailyActivity: {},
  badges: BADGE_DEFINITIONS.map(b => ({ ...b, unlockedAt: undefined })),
  estimatedTimeSaved: 0,
};

// 기본 채널 프로필
export const DEFAULT_CHANNEL_PROFILE: Omit<ChannelProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  targetAudience: '',
  contentStyle: '',
  speakingTone: '',
  specialNotes: '',
  customSystemPrompt: '',
};
