import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  LanguageInfo,
  DEFAULT_LANGUAGES,
  toggleLanguage as toggleLangFn,
  getEnabledLanguages,
  addLanguage as addLangFn,
} from '../lib/languages';

interface LanguageState {
  languages: LanguageInfo[];
  showManager: boolean;

  // Actions
  toggleLanguageEnabled: (code: string) => void;
  getEnabled: () => LanguageInfo[];
  addCustomLanguage: (code: string, name: string, nativeName: string, koreanName: string, fileCode?: string) => boolean;
  toggleManager: () => void;
  reset: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      languages: DEFAULT_LANGUAGES,
      showManager: false,

      toggleLanguageEnabled: (code) => {
        const { languages } = get();
        const updated = toggleLangFn(languages, code);
        set({ languages: updated });
      },

      getEnabled: () => {
        const { languages } = get();
        return getEnabledLanguages(languages);
      },

      addCustomLanguage: (code, name, nativeName, koreanName, fileCode) => {
        const { languages } = get();
        // 이미 있는지 확인
        const existing = languages.find(l => l.code === code);
        if (existing) {
          // 비활성화 상태면 활성화
          if (!existing.enabled) {
            const updated = languages.map(l =>
              l.code === code ? { ...l, enabled: true } : l
            );
            set({ languages: updated });
            return true;
          }
          return false; // 이미 활성화 상태
        }
        const updated = addLangFn(languages, code, name, nativeName, koreanName, fileCode);
        set({ languages: updated });
        return true;
      },

      toggleManager: () =>
        set((state) => ({ showManager: !state.showManager })),

      reset: () =>
        set({
          languages: DEFAULT_LANGUAGES,
          showManager: false,
        }),
    }),
    {
      name: 'subtitle-translator-languages',
      partialize: (state) => ({ languages: state.languages }),
    }
  )
);
