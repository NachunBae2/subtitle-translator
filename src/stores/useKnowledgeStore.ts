import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KnowledgeMemory } from '../types/channel';

interface KnowledgeState {
  memories: KnowledgeMemory[];
  isExpanded: boolean;

  // Actions
  addMemory: (pattern: string, feedback: string, examples?: string[]) => void;
  updateMemory: (id: string, updates: Partial<KnowledgeMemory>) => void;
  removeMemory: (id: string) => void;
  toggleActive: (id: string) => void;
  getActiveMemories: () => KnowledgeMemory[];
  toggleExpanded: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      memories: [],
      isExpanded: false,

      addMemory: (pattern, feedback, examples = []) => {
        const newMemory: KnowledgeMemory = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          pattern,
          feedback,
          examples,
          isActive: true,
          createdAt: new Date(),
        };
        set((state) => ({ memories: [...state.memories, newMemory] }));
      },

      updateMemory: (id, updates) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      removeMemory: (id) => {
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        }));
      },

      toggleActive: (id) => {
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, isActive: !m.isActive } : m
          ),
        }));
      },

      getActiveMemories: () => {
        const { memories } = get();
        return memories.filter((m) => m.isActive);
      },

      toggleExpanded: () =>
        set((state) => ({ isExpanded: !state.isExpanded })),
    }),
    {
      name: 'subtitle-translator-knowledge',
    }
  )
);
