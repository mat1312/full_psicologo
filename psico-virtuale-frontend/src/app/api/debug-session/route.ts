// src/app/api/debug-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    // Creiamo il client Supabase con i cookie - correzione inizializzazione
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Otteniamo la sessione
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return NextResponse.json({
        error: error.message,
        status: 'error'
      }, { status: 500 });
    }
    
    if (!session) {
      return NextResponse.json({
        message: 'Nessuna sessione attiva trovata',
        status: 'not_authenticated'
      }, { status: 200 });
    }
    
    // Restituiamo un riassunto della sessione
    return NextResponse.json({
      status: 'authenticated',
      user: {
        id: session.user.id,
        email: session.user.email,
        has_access_token: !!session.access_token,
        token_length: session.access_token ? session.access_token.length : 0,
        expires_at: session.expires_at
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Errore nel recupero della sessione:', error);
    return NextResponse.json({
      error: error.message || 'Errore interno del server',
      status: 'error'
    }, { status: 500 });
  }
}