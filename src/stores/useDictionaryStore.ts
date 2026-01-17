import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 사전 항목 - 언어별 번역 맵
export interface DictionaryEntry {
  id: string;  // 고유 ID
  translations: Record<string, string>;  // { ko: "대바늘", en: "knitting needle", ja: "棒針" }
}

// 밈 노트 항목 - 언어별 번역 맵
export interface MemeEntry {
  id: string;
  translations: Record<string, string>;  // { ko: "히)", en: "hee)", ja: "ひ)" }
  description?: string;
}

// 단일 사전
export interface Dictionary {
  id: string;
  name: string;
  icon: string;
  category: 'terminology' | 'meme';
  languages: string[];  // 사용 언어 컬럼: ['ko', 'en', 'ja', ...]
  entries: DictionaryEntry[];
  memes: MemeEntry[];
  createdAt: string;
}

// 기본 사전들
const DEFAULT_DICTIONARIES: Dictionary[] = [
  {
    id: 'knitting',
    name: '대바늘',
    icon: '🧶',
    category: 'terminology',
    languages: ['ko', 'en'],  // 기본: 한국어 + 영어
    entries: [],
    memes: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'crochet',
    name: '코바늘',
    icon: '🪡',
    category: 'terminology',
    languages: ['ko', 'en'],
    entries: [],
    memes: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'meme-default',
    name: '기본 밈',
    icon: '💬',
    category: 'meme',
    languages: ['ko', 'en'],
    entries: [],
    memes: [],
    createdAt: new Date().toISOString(),
  },
];

interface DictionaryState {
  dictionaries: Dictionary[];
  activeDictionaryIds: string[];

  // 사전 관리
  addDictionary: (name: string, icon: string, category: 'terminology' | 'meme') => void;
  removeDictionary: (id: string) => void;
  renameDictionary: (id: string, name: string, icon: string) => void;

  // 활성화/비활성화
  toggleDictionary: (id: string) => void;
  setActiveDictionaries: (ids: string[]) => void;

  // 언어 컬럼 관리
  addLanguageColumn: (dictionaryId: string, langCode: string) => void;
  removeLanguageColumn: (dictionaryId: string, langCode: string) => void;

  // 용어 관리 (새 구조)
  addEntry: (dictionaryId: string, translations: Record<string, string>) => void;
  updateEntry: (dictionaryId: string, entryId: string, translations: Record<string, string>) => void;
  removeEntry: (dictionaryId: string, entryId: string) => void;

  // 특정 언어 번역 업데이트 (번역 시 자동 갱신용)
  updateEntryTranslation: (dictionaryId: string, sourceText: string, langCode: string, translation: string) => void;

  // 밈 관리 (새 구조)
  addMeme: (dictionaryId: string, translations: Record<string, string>, description?: string) => void;
  updateMeme: (dictionaryId: string, memeId: string, translations: Record<string, string>, description?: string) => void;
  removeMeme: (dictionaryId: string, memeId: string) => void;

  // 활성 사전 데이터 가져오기
  getActiveTerms: (targetLang?: string) => Record<string, string>;  // 한국어 → 타겟언어
  getActiveTermsFromEnglish: (targetLang: string) => Record<string, string>;  // 영어 → 타겟언어
  getActiveMemes: (targetLang?: string) => Array<{ pattern: string; replacement: string; description?: string }>;  // 한국어 → 타겟언어
  getActiveMemesFromEnglish: (targetLang: string) => Array<{ pattern: string; replacement: string; description?: string }>;  // 영어 → 타겟언어

  // 번역 필요한 엔트리 가져오기 (영어는 있지만 타겟 언어 없는 것)
  getEntriesNeedingTranslation: (targetLang: string) => Array<{ dictionaryId: string; entryId: string; korean: string; english: string }>;
  getMemesNeedingTranslation: (targetLang: string) => Array<{ dictionaryId: string; memeId: string; korean: string; english: string }>;

  // 번역 결과 일괄 업데이트
  bulkUpdateEntryTranslations: (updates: Array<{ korean: string; langCode: string; translation: string }>) => void;
  bulkUpdateMemeTranslations: (updates: Array<{ korean: string; langCode: string; translation: string }>) => void;

  // 프리셋 로드 (레거시 호환)
  loadPreset: (dictionaryId: string, entries: Array<{ korean: string; english: string }>) => void;

  // 대량 추가 (엑셀 붙여넣기용)
  bulkAddEntries: (dictionaryId: string, rows: Array<Record<string, string>>) => void;
  bulkAddMemes: (dictionaryId: string, rows: Array<Record<string, string>>, descriptions?: string[]) => void;

  reset: () => void;
}

export const useDictionaryStore = create<DictionaryState>()(
  persist(
    (set, get) => ({
      dictionaries: DEFAULT_DICTIONARIES,
      activeDictionaryIds: [],

      addDictionary: (name, icon, category) => {
        const id = `custom-${Date.now()}`;
        set((state) => ({
          dictionaries: [
            ...state.dictionaries,
            {
              id,
              name,
              icon,
              category,
              languages: ['ko', 'en'],  // 기본: 한국어 + 영어
              entries: [],
              memes: [],
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      removeDictionary: (id) => {
        set((state) => ({
          dictionaries: state.dictionaries.filter((d) => d.id !== id),
          activeDictionaryIds: state.activeDictionaryIds.filter((aid) => aid !== id),
        }));
      },

      renameDictionary: (id, name, icon) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) =>
            d.id === id ? { ...d, name, icon } : d
          ),
        }));
      },

      toggleDictionary: (id) => {
        set((state) => ({
          activeDictionaryIds: state.activeDictionaryIds.includes(id)
            ? state.activeDictionaryIds.filter((aid) => aid !== id)
            : [...state.activeDictionaryIds, id],
        }));
      },

      setActiveDictionaries: (ids) => {
        set({ activeDictionaryIds: ids });
      },

      // 언어 컬럼 추가
      addLanguageColumn: (dictionaryId, langCode) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) =>
            d.id === dictionaryId && !d.languages.includes(langCode)
              ? { ...d, languages: [...d.languages, langCode] }
              : d
          ),
        }));
      },

      // 언어 컬럼 제거
      removeLanguageColumn: (dictionaryId, langCode) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId || langCode === 'ko') return d;  // ko는 제거 불가
            return {
              ...d,
              languages: d.languages.filter((l) => l !== langCode),
              entries: d.entries.map((e) => {
                const { [langCode]: _, ...rest } = e.translations;
                return { ...e, translations: rest };
              }),
              memes: d.memes.map((m) => {
                const { [langCode]: _, ...rest } = m.translations;
                return { ...m, translations: rest };
              }),
            };
          }),
        }));
      },

      // 용어 추가
      addEntry: (dictionaryId, translations) => {
        const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId) return d;
            // 중복 체크 (ko 기준)
            const exists = d.entries.some((e) => e.translations.ko === translations.ko);
            if (exists) return d;
            return { ...d, entries: [...d.entries, { id, translations }] };
          }),
        }));
      },

      // 용어 수정
      updateEntry: (dictionaryId, entryId, translations) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) =>
            d.id === dictionaryId
              ? {
                  ...d,
                  entries: d.entries.map((e) =>
                    e.id === entryId ? { ...e, translations: { ...e.translations, ...translations } } : e
                  ),
                }
              : d
          ),
        }));
      },

      // 용어 삭제
      removeEntry: (dictionaryId, entryId) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) =>
            d.id === dictionaryId
              ? { ...d, entries: d.entries.filter((e) => e.id !== entryId) }
              : d
          ),
        }));
      },

      // 특정 언어 번역 업데이트 (번역 결과 자동 반영)
      updateEntryTranslation: (dictionaryId, sourceText, langCode, translation) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId) return d;
            // 언어 컬럼 없으면 추가
            const languages = d.languages.includes(langCode) ? d.languages : [...d.languages, langCode];
            return {
              ...d,
              languages,
              entries: d.entries.map((e) =>
                e.translations.ko === sourceText
                  ? { ...e, translations: { ...e.translations, [langCode]: translation } }
                  : e
              ),
            };
          }),
        }));
      },

      // 밈 추가
      addMeme: (dictionaryId, translations, description) => {
        const id = `meme-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId) return d;
            const exists = d.memes.some((m) => m.translations.ko === translations.ko);
            if (exists) return d;
            return { ...d, memes: [...d.memes, { id, translations, description }] };
          }),
        }));
      },

      // 밈 수정
      updateMeme: (dictionaryId, memeId, translations, description) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) =>
            d.id === dictionaryId
              ? {
                  ...d,
                  memes: d.memes.map((m) =>
                    m.id === memeId ? { ...m, translations: { ...m.translations, ...translations }, description } : m
                  ),
                }
              : d
          ),
        }));
      },

      // 밈 삭제
      removeMeme: (dictionaryId, memeId) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) =>
            d.id === dictionaryId
              ? { ...d, memes: d.memes.filter((m) => m.id !== memeId) }
              : d
          ),
        }));
      },

      // 활성 용어 가져오기 (한국어 → 타겟언어)
      getActiveTerms: (targetLang = 'en') => {
        const { dictionaries, activeDictionaryIds } = get();
        const terms: Record<string, string> = {};

        dictionaries
          .filter((d) => activeDictionaryIds.includes(d.id) && d.category === 'terminology')
          .forEach((d) => {
            d.entries.forEach((e) => {
              const source = e.translations.ko;
              const target = e.translations[targetLang];
              if (source && target) {
                terms[source] = target;
              }
            });
          });

        return terms;
      },

      // 활성 용어 가져오기 (영어 → 타겟언어)
      getActiveTermsFromEnglish: (targetLang: string) => {
        const { dictionaries, activeDictionaryIds } = get();
        const terms: Record<string, string> = {};

        dictionaries
          .filter((d) => activeDictionaryIds.includes(d.id) && d.category === 'terminology')
          .forEach((d) => {
            d.entries.forEach((e) => {
              const source = e.translations.en;
              const target = e.translations[targetLang];
              if (source && target) {
                terms[source] = target;
              }
            });
          });

        return terms;
      },

      // 활성 밈 가져오기 (한국어 → 타겟언어)
      getActiveMemes: (targetLang = 'en') => {
        const { dictionaries, activeDictionaryIds } = get();
        const memes: Array<{ pattern: string; replacement: string; description?: string }> = [];

        dictionaries
          .filter((d) => activeDictionaryIds.includes(d.id) && d.category === 'meme')
          .forEach((d) => {
            d.memes.forEach((m) => {
              const pattern = m.translations.ko;
              const replacement = m.translations[targetLang];
              if (pattern && replacement) {
                memes.push({ pattern, replacement, description: m.description });
              }
            });
          });

        return memes;
      },

      // 활성 밈 가져오기 (영어 → 타겟언어)
      getActiveMemesFromEnglish: (targetLang: string) => {
        const { dictionaries, activeDictionaryIds } = get();
        const memes: Array<{ pattern: string; replacement: string; description?: string }> = [];

        dictionaries
          .filter((d) => activeDictionaryIds.includes(d.id) && d.category === 'meme')
          .forEach((d) => {
            d.memes.forEach((m) => {
              const pattern = m.translations.en;
              const replacement = m.translations[targetLang];
              if (pattern && replacement) {
                memes.push({ pattern, replacement, description: m.description });
              }
            });
          });

        return memes;
      },

      // 번역 필요한 엔트리 가져오기 (영어는 있지만 타겟 언어 없는 것)
      getEntriesNeedingTranslation: (targetLang: string) => {
        const { dictionaries, activeDictionaryIds } = get();
        const entries: Array<{ dictionaryId: string; entryId: string; korean: string; english: string }> = [];

        dictionaries
          .filter((d) => activeDictionaryIds.includes(d.id) && d.category === 'terminology')
          .forEach((d) => {
            d.entries.forEach((e) => {
              const korean = e.translations.ko;
              const english = e.translations.en;
              const target = e.translations[targetLang];
              // 한국어와 영어가 있고, 타겟 언어가 없는 경우
              if (korean && english && !target) {
                entries.push({ dictionaryId: d.id, entryId: e.id, korean, english });
              }
            });
          });

        return entries;
      },

      // 밈 번역 필요한 것 가져오기
      getMemesNeedingTranslation: (targetLang: string) => {
        const { dictionaries, activeDictionaryIds } = get();
        const memes: Array<{ dictionaryId: string; memeId: string; korean: string; english: string }> = [];

        dictionaries
          .filter((d) => activeDictionaryIds.includes(d.id) && d.category === 'meme')
          .forEach((d) => {
            d.memes.forEach((m) => {
              const korean = m.translations.ko;
              const english = m.translations.en;
              const target = m.translations[targetLang];
              if (korean && english && !target) {
                memes.push({ dictionaryId: d.id, memeId: m.id, korean, english });
              }
            });
          });

        return memes;
      },

      // 번역 결과 일괄 업데이트 (엔트리)
      bulkUpdateEntryTranslations: (updates) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.category !== 'terminology') return d;
            // 언어 컬럼 추가
            const newLangs = new Set(updates.map(u => u.langCode));
            const languages = [...new Set([...d.languages, ...newLangs])];

            return {
              ...d,
              languages,
              entries: d.entries.map((e) => {
                const update = updates.find(u => u.korean === e.translations.ko);
                if (update) {
                  return { ...e, translations: { ...e.translations, [update.langCode]: update.translation } };
                }
                return e;
              }),
            };
          }),
        }));
      },

      // 번역 결과 일괄 업데이트 (밈)
      bulkUpdateMemeTranslations: (updates) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.category !== 'meme') return d;
            const newLangs = new Set(updates.map(u => u.langCode));
            const languages = [...new Set([...d.languages, ...newLangs])];

            return {
              ...d,
              languages,
              memes: d.memes.map((m) => {
                const update = updates.find(u => u.korean === m.translations.ko);
                if (update) {
                  return { ...m, translations: { ...m.translations, [update.langCode]: update.translation } };
                }
                return m;
              }),
            };
          }),
        }));
      },

      // 프리셋 로드 (레거시 호환)
      loadPreset: (dictionaryId, entries) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId) return d;
            const existingKo = new Set(d.entries.map((e) => e.translations.ko));
            const newEntries = entries
              .filter((e) => !existingKo.has(e.korean))
              .map((e) => ({
                id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                translations: { ko: e.korean, en: e.english },
              }));
            return { ...d, entries: [...d.entries, ...newEntries] };
          }),
        }));
      },

      // 대량 추가 (엑셀 붙여넣기) - 각 row는 { ko: "", en: "", ja: "", ... }
      bulkAddEntries: (dictionaryId, rows) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId) return d;
            const existingKo = new Set(d.entries.map((e) => e.translations.ko));

            // 새 언어 컬럼 감지
            const newLangs = new Set<string>();
            rows.forEach((row) => {
              Object.keys(row).forEach((lang) => {
                if (!d.languages.includes(lang)) newLangs.add(lang);
              });
            });
            const languages = [...d.languages, ...newLangs];

            const newEntries = rows
              .filter((row) => {
                // 빈 행 허용 (모든 값이 빈 문자열이어도 추가)
                // 단, ko 값이 있으면서 이미 존재하는 경우만 제외
                if (row.ko && existingKo.has(row.ko)) return false;
                return true;
              })
              .map((row) => ({
                id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                translations: row,
              }));
            return { ...d, languages, entries: [...d.entries, ...newEntries] };
          }),
        }));
      },

      // 대량 밈 추가
      bulkAddMemes: (dictionaryId, rows, descriptions = []) => {
        set((state) => ({
          dictionaries: state.dictionaries.map((d) => {
            if (d.id !== dictionaryId) return d;
            const existingKo = new Set(d.memes.map((m) => m.translations.ko));

            const newLangs = new Set<string>();
            rows.forEach((row) => {
              Object.keys(row).forEach((lang) => {
                if (!d.languages.includes(lang)) newLangs.add(lang);
              });
            });
            const languages = [...d.languages, ...newLangs];

            const newMemes = rows
              .filter((row) => {
                // 빈 행 허용 (모든 값이 빈 문자열이어도 추가)
                // 단, ko 값이 있으면서 이미 존재하는 경우만 제외
                if (row.ko && existingKo.has(row.ko)) return false;
                return true;
              })
              .map((row, i) => ({
                id: `meme-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                translations: row,
                description: descriptions[i],
              }));
            return { ...d, languages, memes: [...d.memes, ...newMemes] };
          }),
        }));
      },

      reset: () => {
        set({
          dictionaries: DEFAULT_DICTIONARIES,
          activeDictionaryIds: [],
        });
      },
    }),
    {
      name: 'subtitle-translator-dictionaries',
      version: 2,  // 마이그레이션 버전
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as DictionaryState;
        if (version < 2) {
          // v1 -> v2: languages 필드 추가, entries/memes 구조 변경
          return {
            ...state,
            dictionaries: state.dictionaries.map((d) => ({
              ...d,
              languages: d.languages || ['ko', 'en'],
              entries: d.entries.map((e: DictionaryEntry | { korean?: string; english?: string }) => {
                if ('translations' in e) return e;
                const legacy = e as { korean?: string; english?: string };
                return {
                  id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  translations: { ko: legacy.korean || '', en: legacy.english || '' },
                };
              }),
              memes: d.memes.map((m: MemeEntry | { pattern?: string; replacement?: string; description?: string }) => {
                if ('translations' in m) return m;
                const legacy = m as { pattern?: string; replacement?: string; description?: string };
                return {
                  id: `meme-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  translations: { ko: legacy.pattern || '', en: legacy.replacement || '' },
                  description: legacy.description,
                };
              }),
            })),
          };
        }
        return state;
      },
    }
  )
);
