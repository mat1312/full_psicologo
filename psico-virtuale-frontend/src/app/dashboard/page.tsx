'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function DashboardPage() {
  const { user, loading, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    console.log("Dashboard check - User:", user?.role, "Loading:", loading, "Initialized:", initialized)
    
    if (!loading && initialized) {
      if (!user) {
        console.log("Redirecting to login - No user")
        router.push('/login')
      } else if (user.role === 'therapist') {
        console.log("Redirecting to therapist dashboard")
        router.push('/therapist-dashboard')
      } else {
        console.log("Redirecting to patient dashboard")
        router.push('/patient-dashboard')
      }
    }
  }, [user, loading, initialized, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Reindirizzamento in corso...</p>
    </div>
  )
}