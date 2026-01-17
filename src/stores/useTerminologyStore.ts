import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Terminology,
  TranslationRule,
  loadTerminology,
  addTerm as addTermFn,
  removeTerm as removeTermFn,
  addRule as addRuleFn,
  removeRule as removeRuleFn,
  getAllRules,
  getDefaultTerminology,
} from '../lib/terminology';

interface TerminologyState {
  terminology: Terminology;
  isExpanded: boolean;
  newKorean: string;
  newEnglish: string;

  // Actions
  addTerm: (korean: string, english: string) => void;
  removeTerm: (korean: string) => void;
  addRule: (pattern: string, replacement: string, description?: string) => void;
  removeRule: (pattern: string) => void;
  getRules: () => TranslationRule[];
  toggleExpanded: () => void;
  setNewKorean: (value: string) => void;
  setNewEnglish: (value: string) => void;
  loadPreset: (preset: Terminology) => void;  // 프리셋 로드 (기존 용어에 병합)
  reset: () => void;
}

export const useTerminologyStore = create<TerminologyState>()(
  persist(
    (set, get) => ({
      terminology: loadTerminology(),
      isExpanded: false,
      newKorean: '',
      newEnglish: '',

      addTerm: (korean, english) => {
        const { terminology } = get();
        const updated = addTermFn(terminology, korean, english);
        set({ terminology: updated, newKorean: '', newEnglish: '' });
      },

      removeTerm: (korean) => {
        const { terminology } = get();
        const updated = removeTermFn(terminology, korean);
        set({ terminology: updated });
      },

      addRule: (pattern, replacement, description) => {
        const { terminology } = get();
        const updated = addRuleFn(terminology, pattern, replacement, description);
        set({ terminology: updated });
      },

      removeRule: (pattern) => {
        const { terminology } = get();
        const updated = removeRuleFn(terminology, pattern);
        set({ terminology: updated });
      },

      getRules: () => {
        const { terminology } = get();
        return getAllRules(terminology);
      },

      toggleExpanded: () =>
        set((state) => ({ isExpanded: !state.isExpanded })),

      setNewKorean: (newKorean) => set({ newKorean }),
      setNewEnglish: (newEnglish) => set({ newEnglish }),

      loadPreset: (preset) => {
        const { terminology } = get();
        set({
          terminology: {
            terms: { ...terminology.terms, ...preset.terms },
            rules: terminology.rules,
            multilang: terminology.multilang,
          },
        });
      },

      reset: () =>
        set({
          terminology: getDefaultTerminology(),
          isExpanded: false,
          newKorean: '',
          newEnglish: '',
        }),
    }),
    {
      name: 'subtitle-translator-terminology',
      partialize: (state) => ({ terminology: state.terminology }),
    }
  )
);
