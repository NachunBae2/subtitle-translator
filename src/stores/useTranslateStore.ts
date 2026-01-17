import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SubtitleBlock {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'edited';

interface TranslateState {
  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Step 1: Korean source
  koreanBlocks: SubtitleBlock[];
  koreanRaw: string;
  originalFileName: string; // 원본 파일명 (확장자 제외)

  // Step 2: English translation (editable)
  englishBlocks: SubtitleBlock[];
  englishRaw: string;
  reviewStatus: Record<number, ReviewStatus>; // block id -> status

  // Step 3: Multi-language translations
  selectedLanguages: string[];
  multiLangResults: Record<string, string>; // lang code -> srt text

  // UI State
  highlightedBlockId: number | null;
  syncScroll: boolean;

  // Actions
  setKoreanBlocks: (blocks: SubtitleBlock[], raw: string, fileName?: string) => void;
  setOriginalFileName: (fileName: string) => void;
  setEnglishBlocks: (blocks: SubtitleBlock[], raw: string) => void;
  updateEnglishBlock: (id: number, text: string) => void;
  setReviewStatus: (id: number, status: ReviewStatus) => void;
  approveAll: () => void;

  toggleLanguage: (code: string) => void;
  setSelectedLanguages: (codes: string[]) => void;
  setMultiLangResult: (langCode: string, content: string) => void;
  removeMultiLangResult: (langCode: string) => void;

  setHighlightedBlock: (id: number | null) => void;
  setSyncScroll: (sync: boolean) => void;

  clearAll: () => void;
  reset: () => void;
}

export const useTranslateStore = create<TranslateState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      koreanBlocks: [],
      koreanRaw: '',
      originalFileName: '',
      englishBlocks: [],
      englishRaw: '',
      reviewStatus: {},
      selectedLanguages: [],
      multiLangResults: {},
      highlightedBlockId: null,
      syncScroll: true,

      setKoreanBlocks: (blocks, raw, fileName) => {
        // 파일명에서 확장자 제거
        const baseName = fileName ? fileName.replace(/\.(srt|txt)$/i, '') : '';
        set({ koreanBlocks: blocks, koreanRaw: raw, originalFileName: baseName });
      },

      setOriginalFileName: (fileName) => {
        const baseName = fileName.replace(/\.(srt|txt)$/i, '');
        set({ originalFileName: baseName });
      },

      setEnglishBlocks: (blocks, raw) => {
        const reviewStatus: Record<number, ReviewStatus> = {};
        blocks.forEach((b) => {
          reviewStatus[b.id] = 'pending';
        });
        set({ englishBlocks: blocks, englishRaw: raw, reviewStatus });
      },

      updateEnglishBlock: (id, text) => {
        const { englishBlocks, reviewStatus } = get();
        const newBlocks = englishBlocks.map((b) =>
          b.id === id ? { ...b, text } : b
        );
        // englishRaw도 함께 업데이트 (실시간 동기화)
        const newEnglishRaw = newBlocks.map((b) =>
          `${b.id}\n${b.startTime} --> ${b.endTime}\n${b.text}`
        ).join('\n\n');
        set({
          englishBlocks: newBlocks,
          englishRaw: newEnglishRaw,
          reviewStatus: { ...reviewStatus, [id]: 'pending' },
        });
      },

      setReviewStatus: (id, status) =>
        set((state) => ({
          reviewStatus: { ...state.reviewStatus, [id]: status },
        })),

      approveAll: () => {
        const { englishBlocks } = get();
        const reviewStatus: Record<number, ReviewStatus> = {};
        englishBlocks.forEach((b) => {
          reviewStatus[b.id] = 'approved';
        });
        set({ reviewStatus });
      },

      toggleLanguage: (code) => {
        const { selectedLanguages } = get();
        const newSelected = selectedLanguages.includes(code)
          ? selectedLanguages.filter((c) => c !== code)
          : [...selectedLanguages, code];
        set({ selectedLanguages: newSelected });
      },

      setSelectedLanguages: (codes) => set({ selectedLanguages: codes }),

      setMultiLangResult: (langCode, content) =>
        set((state) => ({
          multiLangResults: {
            ...state.multiLangResults,
            [langCode]: content,
          },
        })),

      removeMultiLangResult: (langCode) =>
        set((state) => {
          const { [langCode]: _, ...rest } = state.multiLangResults;
          return { multiLangResults: rest };
        }),

      setHighlightedBlock: (id) => set({ highlightedBlockId: id }),

      setSyncScroll: (sync) => set({ syncScroll: sync }),

      clearAll: () =>
        set({
          koreanBlocks: [],
          koreanRaw: '',
          originalFileName: '',
          englishBlocks: [],
          englishRaw: '',
          reviewStatus: {},
          multiLangResults: {},
          highlightedBlockId: null,
        }),

      reset: () =>
        set({
          koreanBlocks: [],
          koreanRaw: '',
          originalFileName: '',
          englishBlocks: [],
          englishRaw: '',
          reviewStatus: {},
          selectedLanguages: [],
          multiLangResults: {},
          highlightedBlockId: null,
          syncScroll: true,
        }),
    }),
    {
      name: 'subtitle-translate-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        koreanBlocks: state.koreanBlocks,
        koreanRaw: state.koreanRaw,
        originalFileName: state.originalFileName,
        englishBlocks: state.englishBlocks,
        englishRaw: state.englishRaw,
        reviewStatus: state.reviewStatus,
        selectedLanguages: state.selectedLanguages,
        multiLangResults: state.multiLangResults,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
