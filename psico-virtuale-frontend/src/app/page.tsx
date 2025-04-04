'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function Home() {
  const { user, loading, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    console.log("Home check - User:", !!user, "Loading:", loading, "Initialized:", initialized)
    
    // Aspetta che lo store sia inizializzato prima di reindirizzare
    if (initialized) {
      if (user) {
        console.log("Redirecting to dashboard from home")
        router.push('/dashboard')
      } else {
        console.log("Redirecting to login from home")
        router.push('/login')
      }
    }
  }, [user, loading, initialized, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Reindirizzamento in corso...</p>
    </div>
  )
}