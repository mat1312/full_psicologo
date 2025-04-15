import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: any | null) => void;
  clearAuth: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      loading: true,
      initialized: false,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      clearAuth: () => set({ user: null, session: null }),
      initialize: async () => {
        try {
          set({ loading: true });
          const { data } = await supabase.auth.getSession();
          const { session } = data;
          
          if (session) {
            const user = session.user;
            set({ 
              user, 
              session, 
              initialized: true, 
              loading: false 
            });
          } else {
            set({ 
              user: null, 
              session: null, 
              initialized: true, 
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ initialized: true, loading: false });
        }
      }
    }),
    {
      name: 'auth-storage',
    }
  )
); 