// Per verificare se il middleware sta causando problemi, puoi:

// OPZIONE 1: Disabilitare temporaneamente il middleware rinominandolo
// Rinomina src/middleware.ts a src/middleware.ts.bak

// OPZIONE 2: Modificarlo per consentire esplicitamente le pagine dashboard
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  console.log("Middleware executing for path:", req.nextUrl.pathname);
  
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Ottieni la sessione. Questo gestisce anche il refresh e imposta i cookie su 'res'.
  const { data: { session } } = await supabase.auth.getSession();
  
  console.log("Middleware auth check result:", !!session);

  // Se non c'è sessione E la rotta è protetta, reindirizza al login
  const isProtectedRoute = config.matcher.some(pattern => 
    new RegExp(`^${pattern.replace('*', '.*')}$`).test(req.nextUrl.pathname)
  );

  if (!session && isProtectedRoute) {
    console.log(`No session found for protected route ${req.nextUrl.pathname}. Redirecting to /login.`);
    const redirectUrl = new URL('/login', req.url);
    // Aggiungi un parametro per indicare da dove veniamo, utile dopo il login
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/chat/:path*',
    '/patient-dashboard/:path*',
    '/therapist-dashboard/:path*'
  ],
}