import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Estrai l'Authorization header direttamente dalla richiesta
    const authorization = req.headers.get('Authorization');
    
    if (!authorization) {
      console.error("[Patient Chat API] Nessun token di autorizzazione trovato nell'header");
      return NextResponse.json(
        { error: 'Token di autenticazione mancante' }, 
        { status: 401 }
      );
    }

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

    // Chiama il nuovo endpoint /api/patient-chat del backend
    const response = await fetch(`${backendUrl}/api/patient-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body: JSON.stringify({ query, session_id, mood })
    });
    
    // Gestione avanzata degli errori dal backend
    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error("[Patient Chat API] Errore dal backend:", response.status, errorData);
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
        console.error("[Patient Chat API] Errore non JSON dal backend:", response.status, errorText);
        return NextResponse.json(
          { error: `Errore del server (${response.status}): ${errorText}` }, 
          { status: response.status }
        );
      }
    }
    
    // Restituisci la risposta del backend
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Patient Chat API] Errore nella gestione della richiesta chat:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
} 