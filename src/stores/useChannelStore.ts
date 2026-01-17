import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChannelProfile } from '../types/channel';

interface ChannelState {
  profile: ChannelProfile | null;
  isOnboardingComplete: boolean;

  // Actions
  setProfile: (profile: Omit<ChannelProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProfile: (updates: Partial<ChannelProfile>) => void;
  setSystemPrompt: (prompt: string) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
}

export const useChannelStore = create<ChannelState>()(
  persist(
    (set, get) => ({
      profile: null,
      isOnboardingComplete: false,

      setProfile: (profile) => {
        const now = new Date();
        const newProfile: ChannelProfile = {
          ...profile,
          id: Date.now().toString(36) + Math.random().toString(36).substring(2),
          createdAt: now,
          updatedAt: now,
        };
        set({ profile: newProfile, isOnboardingComplete: true });
      },

      updateProfile: (updates) => {
        const { profile } = get();
        if (!profile) return;

        const updatedProfile: ChannelProfile = {
          ...profile,
          ...updates,
          updatedAt: new Date(),
        };
        set({ profile: updatedProfile });
      },

      setSystemPrompt: (prompt) => {
        const { profile } = get();
        if (!profile) return;

        const updatedProfile: ChannelProfile = {
          ...profile,
          customSystemPrompt: prompt,
          updatedAt: new Date(),
        };
        set({ profile: updatedProfile });
      },

      completeOnboarding: () => {
        set({ isOnboardingComplete: true });
      },

      resetProfile: () => {
        set({ profile: null, isOnboardingComplete: false });
      },
    }),
    {
      name: 'subtitle-translator-channel',
    }
  )
);
