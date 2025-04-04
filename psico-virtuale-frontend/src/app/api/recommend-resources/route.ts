// src/app/api/recommend-resources/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Rimuovi import non necessari
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'; 
// import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { query, session_id } = data;
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'ID sessione mancante' },
        { status: 400 }
      );
    }

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

    // Usa l'URL del backend da variabili d'ambiente
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    
    // Passa semplicemente l'auth header ricevuto al backend
    const response = await fetch(`${backendUrl}/api/recommend-resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization // Usa l'header ricevuto
      },
      body: JSON.stringify({ query, session_id })
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
      
      console.error("[API Route] Errore dal backend:", response.status, errorData);
      
      // Se è un errore di autenticazione DAL BACKEND, restituisci un errore 401
      if (response.status === 401) {
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
    
    const responseData = await response.json();
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[API Route] Errore nel recupero delle risorse consigliate:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}