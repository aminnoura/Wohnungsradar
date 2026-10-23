import AsyncStorage from '@react-native-async-storage/async-storage';
import { TenantProfileSchema, type TenantProfile } from '@wr/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ProfileState {
  profile: TenantProfile;
  set: (patch: Partial<TenantProfile>) => void;
}

/** Applicant profile for contact messages. Kept on the device; only sent along when a message is generated. */
export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      profile: TenantProfileSchema.parse({}),
      set: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
    }),
    { name: 'wr.profile', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
