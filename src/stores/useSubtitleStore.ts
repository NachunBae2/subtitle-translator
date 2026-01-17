import { create } from 'zustand';
import { parseSRT, SubtitleBlock } from '../lib/srt';

interface SubtitleState {
  inputText: string;
  originalBlocks: SubtitleBlock[];
  fileName: string | null;

  // Actions
  setInputText: (text: string) => void;
  setFileName: (name: string | null) => void;
  parseSubtitles: () => void;
  clear: () => void;
}

export const useSubtitleStore = create<SubtitleState>((set, get) => ({
  inputText: '',
  originalBlocks: [],
  fileName: null,

  setInputText: (inputText) => set({ inputText }),

  setFileName: (fileName) => set({ fileName }),

  parseSubtitles: () => {
    const { inputText } = get();
    try {
      const blocks = parseSRT(inputText);
      set({ originalBlocks: blocks });
    } catch {
      set({ originalBlocks: [] });
    }
  },

  clear: () =>
    set({
      inputText: '',
      originalBlocks: [],
      fileName: null,
    }),
}));
