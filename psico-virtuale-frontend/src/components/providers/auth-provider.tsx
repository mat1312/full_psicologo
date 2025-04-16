'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: any | null
  loading: boolean
  initialized: boolean
  signOut: () => Promise<void>
}

// Context con valori default
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  initialized: false,
  signOut: async () => {}
})

// Hook personalizzato per usare il context
export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { initialize, user, loading, initialized } = useAuthStore()
  const router = useRouter()

  // Funzione per logout
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      useAuthStore.setState({ user: null, session: null })
      router.push('/login')
    } catch (error) {
      console.error('Errore nel logout:', error)
    }
  }

  // Funzione per determinare il ruolo dell'utente
  const determineUserRole = (user: any) => {
    // Debug info
    console.log('Determining user role from:', user)
    console.log('Role from profile:', user.role)
    console.log('User metadata:', user.user_metadata)
    
    // Controlla prima il ruolo esplicito dal profilo
    if (user.role === 'therapist') {
      console.log('User is therapist by profile role')
      return 'therapist'
    }
    
    // Poi controlla i metadata dell'auth user
    if (user.user_metadata?.role === 'therapist') {
      console.log('User is therapist by user_metadata')
      return 'therapist'
    }
    
    // Controlla email (solo come fallback)
    if (user.email?.includes('therapist') || user.email?.includes('psicologo')) {
      console.log('User is therapist by email')
      return 'therapist'
    }
    
    // Default: paziente
    console.log('User is patient (default)')
    return 'patient'
  }

  // Inizializziamo lo store all'avvio
  useEffect(() => {
    initialize()
  }, [initialize])

  // Configuriamo il listener e gestiamo i redirect
  useEffect(() => {
    // Setup listener per autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        console.log('Auth event:', event)
        
        if (event === 'SIGNED_IN') {
          // Quando l'utente fa login, aggiorna lo store
          console.log('Utente autenticato, inizializzando...')
          await initialize()
          
          // Ottieni l'utente attuale dallo store
          const currentUser = useAuthStore.getState().user
          console.log('User from store after initialize:', currentUser)
          
          // Eseguiamo il redirect dopo un breve ritardo
          setTimeout(() => {
            if (currentUser) {
              console.log('Esecuzione redirect dopo login...')
              
              // Determina il ruolo e fai redirect alla dashboard appropriata
              const role = determineUserRole(currentUser)
              console.log('Determined role:', role)
              
              const path = role === 'therapist' ? '/therapist-dashboard' : '/patient-dashboard'
              console.log('Redirecting to:', path)
              
              router.push(path)
            } else {
              console.log('User not found in store, default redirect')
              router.push('/patient-dashboard')
            }
          }, 500) // Slightly longer delay to ensure store is updated
        } 
        else if (event === 'SIGNED_OUT') {
          console.log('Utente disconnesso, redirect al login...')
          useAuthStore.setState({ user: null, session: null })
          router.push('/login')
        }
        // Ignoriamo tutti gli altri eventi
      }
    )

    // Reindirizza l'utente se già autenticato
    if (!loading && initialized && user) {
      console.log('Utente già autenticato, redirect alla dashboard...')
      console.log('User data:', user)
      
      // Determina la destinazione in base al ruolo
      const role = determineUserRole(user)
      console.log('Determined role for existing user:', role)
      
      const path = role === 'therapist' ? '/therapist-dashboard' : '/patient-dashboard'
      console.log('Redirecting existing user to:', path)
      
      router.push(path)
    }
    
    // Cleanup
    return () => {
      subscription.unsubscribe()
    }
  }, [initialize, router, user, loading, initialized])
  
  // Esponi lo stato corrente tramite context
  const value = {
    user,
    loading,
    initialized,
    signOut
  }
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}