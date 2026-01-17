// 동적 언어 관리 모듈

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  koreanName: string; // 한국어 이름
  fileCode: string; // 3-letter code for file naming: [ENG], [JAP], etc.
  enabled: boolean;
}

// 기본 지원 언어 목록
export const DEFAULT_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', koreanName: '영어', fileCode: 'ENG', enabled: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', koreanName: '중국어', fileCode: 'CHN', enabled: true },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', koreanName: '베트남어', fileCode: 'VIE', enabled: true },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', koreanName: '이탈리아어', fileCode: 'ITA', enabled: true },
  { code: 'fr', name: 'French', nativeName: 'Français', koreanName: '프랑스어', fileCode: 'FRA', enabled: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', koreanName: '스페인어', fileCode: 'SPA', enabled: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', koreanName: '독일어', fileCode: 'DEU', enabled: true },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', koreanName: '터키어', fileCode: 'TUR', enabled: true },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', koreanName: '우크라이나어', fileCode: 'UKR', enabled: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', koreanName: '일본어', fileCode: 'JAP', enabled: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', koreanName: '포르투갈어', fileCode: 'POR', enabled: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', koreanName: '러시아어', fileCode: 'RUS', enabled: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', koreanName: '아랍어', fileCode: 'ARA', enabled: false },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', koreanName: '힌디어', fileCode: 'HIN', enabled: false },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', koreanName: '태국어', fileCode: 'THA', enabled: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', koreanName: '인도네시아어', fileCode: 'IND', enabled: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', koreanName: '네덜란드어', fileCode: 'NLD', enabled: false },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', koreanName: '폴란드어', fileCode: 'POL', enabled: false },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', koreanName: '스웨덴어', fileCode: 'SWE', enabled: false },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', koreanName: '체코어', fileCode: 'CZE', enabled: false },
];

// 언어 코드로 fileCode 가져오기
export function getFileCode(languages: LanguageInfo[], code: string): string {
  const lang = languages.find(l => l.code === code);
  return lang?.fileCode || code.toUpperCase();
}

const STORAGE_KEY = 'subtitle-translator-languages';

// 저장된 언어 목록 불러오기
export function loadLanguages(): LanguageInfo[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    console.warn('Failed to load languages from storage');
  }
  return DEFAULT_LANGUAGES;
}

// 언어 목록 저장
export function saveLanguages(languages: LanguageInfo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(languages));
}

// 활성화된 언어만 가져오기
export function getEnabledLanguages(languages: LanguageInfo[]): LanguageInfo[] {
  return languages.filter(lang => lang.enabled);
}

// 언어 활성화/비활성화 토글
export function toggleLanguage(languages: LanguageInfo[], code: string): LanguageInfo[] {
  return languages.map(lang =>
    lang.code === code ? { ...lang, enabled: !lang.enabled } : lang
  );
}

// 새 언어 추가
export function addLanguage(
  languages: LanguageInfo[],
  code: string,
  name: string,
  nativeName: string,
  koreanName: string,
  fileCode?: string
): LanguageInfo[] {
  // 중복 체크
  if (languages.some(l => l.code === code)) {
    return languages;
  }
  // fileCode가 없으면 code를 대문자 3글자로 변환
  const generatedFileCode = fileCode || code.toUpperCase().slice(0, 3);
  return [...languages, { code, name, nativeName, koreanName, fileCode: generatedFileCode, enabled: true }];
}

// 언어 표시 이름: [fileCode] 한국어이름 (원어이름)
// 예: [JAP] 일본어 (日本語)
export function getDisplayName(lang: LanguageInfo, includeCode = true): string {
  const koreanName = lang.koreanName || lang.name;
  const nativeName = lang.nativeName;

  if (includeCode) {
    return `[${lang.fileCode}] ${koreanName} (${nativeName})`;
  }
  return `${koreanName} (${nativeName})`;
}
