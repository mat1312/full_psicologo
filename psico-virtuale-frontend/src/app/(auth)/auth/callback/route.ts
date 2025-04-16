import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    try {
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code)
      
      // Get user to determine role
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Try to get profile data to determine role
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        // Determine dashboard based on role
        if (profileData?.role === 'therapist' || 
            user.user_metadata?.role === 'therapist' ||
            user.email?.includes('therapist') || 
            user.email?.includes('psicologo')) {
          return NextResponse.redirect(requestUrl.origin + '/therapist-dashboard')
        }
      }
    } catch (error) {
      console.error('Error in auth callback:', error)
    }
  }

  // Default redirect to patient dashboard
  return NextResponse.redirect(requestUrl.origin + '/patient-dashboard')
}