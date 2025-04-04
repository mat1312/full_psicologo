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

    // // Rimuovi log specifico di Supabase
    // console.log("Token trovato per chat:", ...);

    // Estrai i dati dalla richiesta
    const { query, session_id, mood } = await req.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Messaggio mancante' },
        { status: 400 }
      );
    }

    // Usa l'URL del backend da variabili d'ambiente
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    // Passa semplicemente l'auth header ricevuto al backend
    const response = await fetch(`${backendUrl}/therapy-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization // Usa l'header ricevuto
      },
      body: JSON.stringify({ query, session_id, mood })
    });
    
    // 6. Gestione avanzata degli errori dal backend
    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error("[API Route] Errore dal backend:", response.status, errorData);
        // Se è un errore di autenticazione DAL BACKEND, restituisci un errore 401
        if (response.status === 401) {
          return NextResponse.json(
            { error: errorData.detail || 'Utente non autenticato o sessione scaduta (backend)' }, 
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          { error: errorData.detail || 'Errore del server' }, 
          { status: response.status }
        );
      } catch (e) {
        const errorText = await response.text();
        console.error("[API Route] Errore non JSON dal backend:", response.status, errorText);
        return NextResponse.json(
          { error: `Errore del server (${response.status}): ${errorText}` }, 
          { status: response.status }
        );
      }
    }
    
    // 7. Restituisci la risposta del backend
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API Route] Errore nella gestione della richiesta chat:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}