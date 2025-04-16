'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'

export default function Dashboard() {
  const { user, loading } = useAuthStore()

  // Return a loading state while the auth provider handles redirection
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Reindirizzamento...</h1>
        <p className="text-gray-600">Stai per essere reindirizzato alla dashboard.</p>
        <p className="text-gray-500 mt-4 text-sm">
          {loading ? 'Caricamento in corso...' : (user ? `Utente autenticato come ${user.role}` : 'Nessun utente autenticato')}
        </p>
      </div>
    </div>
  )
}