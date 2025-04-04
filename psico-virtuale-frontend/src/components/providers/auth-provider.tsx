'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: any | null
  loading: boolean
  initialized: boolean
}

// Context con valori default
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  initialized: false
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

  useEffect(() => {
    // Inizializza lo store all'avvio
    initialize()
    
    // Configura il listener per i cambiamenti di auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Se c'è una nuova sessione, aggiorna lo store
          await initialize()
        } else if (event === 'SIGNED_OUT') {
          // Se l'utente ha effettuato il logout, cancella lo store
          useAuthStore.setState({ user: null, session: null })
          router.push('/login')
        }
      }
    )
    
    // Cleanup della subscription quando il componente viene smontato
    return () => {
      subscription.unsubscribe()
    }
  }, [initialize, router])
  
  // Esponi lo stato corrente tramite context
  const value = {
    user,
    loading,
    initialized
  }
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}