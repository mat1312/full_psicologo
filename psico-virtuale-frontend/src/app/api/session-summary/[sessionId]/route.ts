// src/app/api/session-summary/[sessionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Crea una risposta vuota che poi modificheremo
    const res = NextResponse.next();
    
    // Usa il middleware client che è progettato per funzionare con Next.js
    const supabase = createMiddlewareClient({ req, res });
    
    // Recupera la sessione
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Errore nel recupero della sessione:", sessionError);
      return NextResponse.json(
        { error: `Errore di autenticazione: ${sessionError.message}` }, 
        { status: 401 }
      );
    }
    
    if (!session) {
      console.error("Nessuna sessione attiva trovata");
      return NextResponse.json(
        { error: 'Utente non autenticato' }, 
        { status: 401 }
      );
    }

    // Log per debug - Corretto per gestire expires_at undefined
    console.log("Token trovato per session-summary:", session?.access_token ? "Sì" : "No",
                session?.expires_at ? `Scade: ${new Date(session.expires_at * 1000).toLocaleString()}` : "Scadenza non disponibile");

    // Controlla che sessionId sia presente
    const { sessionId } = params;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID sessione mancante' },
        { status: 400 }
      );
    }

    // Usa l'URL del backend da variabili d'ambiente
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    // Chiama il backend
    const response = await fetch(`${backendUrl}/api/session-summary/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) {
      // Gestione avanzata degli errori
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        const errorText = await response.text();
        errorData = { detail: errorText };
      }
      
      // Se è un errore di autenticazione, restituisci un errore 401
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Utente non autenticato o sessione scaduta' }, 
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: errorData.detail || `Errore del server (${response.status})` }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Errore nel recupero del riepilogo della sessione:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}