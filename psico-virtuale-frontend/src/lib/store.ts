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
  signOut: () => Promise<void>;
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
      signOut: async () => {
        try {
          await supabase.auth.signOut();
          set({ user: null, session: null });
        } catch (error) {
          console.error('Errore durante il logout:', error);
        }
      },
      initialize: async () => {
        try {
          set({ loading: true });
          const { data } = await supabase.auth.getSession();
          const { session } = data;
          
          if (session) {
            const user = session.user;
            
            try {
              // Recupera il profilo utente da Supabase
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
                
              if (profileData && !profileError) {
                // Aggiunge i dati del profilo all'utente
                const enhancedUser = {
                  ...user,
                  ...profileData // Include role e altri campi del profilo
                };
                
                console.log('User profile loaded:', enhancedUser);
                
                set({ 
                  user: enhancedUser, 
                  session, 
                  initialized: true, 
                  loading: false 
                });
              } else {
                console.warn('Profilo utente non trovato:', profileError);
                set({ 
                  user, 
                  session, 
                  initialized: true, 
                  loading: false 
                });
              }
            } catch (profileLoadError) {
              console.error('Errore caricamento profilo:', profileLoadError);
              set({ 
                user, 
                session, 
                initialized: true, 
                loading: false 
              });
            }
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