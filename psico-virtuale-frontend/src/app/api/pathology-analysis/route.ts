import { NextRequest, NextResponse } from 'next/server';
// Rimuovi import non necessari
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
// import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    // // Rimuovi validazione sessione Supabase qui
    // const cookieStore = cookies();
    // const supabase = createServerComponentClient({ cookies: () => cookieStore });
    // const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    // if (sessionError || !session) { ... }

    // Estrai l'Authorization header direttamente dalla richiesta
    const authorization = req.headers.get('Authorization');
    
    if (!authorization) {
      console.error("[API Route] Nessun token di autorizzazione trovato nell'header");
      return NextResponse.json(
        { error: 'Token di autenticazione mancante' }, 
        { status: 401 }
      );
    }

    // Log dettagliato del token per debug
    console.log("[API Route] Token ricevuto. Lunghezza:", authorization.length);
    console.log("[API Route] Token formato corretto:", authorization.startsWith('Bearer '));
    if (authorization.startsWith('Bearer ')) {
      const token = authorization.substring(7);
      console.log("[API Route] Token effettivo. Lunghezza:", token.length, "Prefisso:", token.substring(0, 10) + "...");
    }

    // Estrai i dati
    const { 
      session_id, 
      analyze_chatbot = true, 
      analyze_elevenlabs = false, 
      elevenlabs_conversation_id = null 
    } = await req.json();
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'ID sessione mancante' },
        { status: 400 }
      );
    }

    // Usa l'URL del backend da variabili d'ambiente
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    console.log("[API Route] URL backend:", backendUrl);

    // Passa semplicemente l'auth header ricevuto al backend
    console.log("[API Route] Inoltro richiesta al backend con token...");
    const response = await fetch(`${backendUrl}/api/pathology-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization // Usa l'header ricevuto
      },
      body: JSON.stringify({ 
        session_id, 
        analyze_chatbot, 
        analyze_elevenlabs, 
        elevenlabs_conversation_id 
      })
    });
    
    if (!response.ok) {
      // Gestione avanzata degli errori
      let errorData;
      try {
        errorData = await response.json();
        console.error("[API Route] Errore dal backend:", response.status, errorData);
      } catch (e) {
        const errorText = await response.text();
        console.error("[API Route] Errore non JSON dal backend:", response.status, errorText);
        errorData = { detail: errorText };
      }
      
      // Se è un errore di autenticazione DAL BACKEND, restituisci un errore 401
      if (response.status === 401) {
        // Test diretto del token contro l'endpoint di debug
        console.log("[API Route] Test diretto del token via endpoint debug...");
        try {
          const debugResponse = await fetch(`${backendUrl}/api/debug/token`, {
            method: 'GET',
            headers: {
              'Authorization': authorization
            }
          });
          
          const debugData = await debugResponse.json();
          console.log("[API Route] Risposta debug token:", debugData);
        } catch (debugError) {
          console.error("[API Route] Errore nel test debug del token:", debugError);
        }
        
        return NextResponse.json(
          { error: errorData.detail || 'Utente non autenticato o sessione scaduta (backend)' }, 
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
    console.error('[API Route] Errore nell\'analisi delle patologie:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}