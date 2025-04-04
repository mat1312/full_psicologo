import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per l'analisi dell'umore (bypassando RLS)
export async function GET(request: NextRequest) {
  try {
    // Usa la chiave di servizio che bypassa RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";
    
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Chiave di servizio non configurata' },
        { status: 500 }
      );
    }

    // Ottieni l'ID della sessione dai parametri della richiesta
    const sessionId = request.nextUrl.searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID sessione richiesto' },
        { status: 400 }
      );
    }

    // Crea un client con la chiave di servizio (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log(`Server: Analisi dell'umore per sessione ${sessionId}`);
    
    // Recupera i messaggi della sessione
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
      
    if (messagesError) {
      console.error('Server: Errore nel recupero dei messaggi:', messagesError);
      return NextResponse.json(
        { error: `Errore nel recupero dei messaggi: ${messagesError.message}` },
        { status: 500 }
      );
    }
    
    if (!messages || messages.length === 0) {
      return NextResponse.json({
        mood_analysis: "# Analisi dell'Umore\n\n**Dati insufficienti per l'analisi.**\n\nNon ci sono conversazioni disponibili da analizzare."
      });
    }
    
    // Formatta i messaggi per l'analisi
    const conversation = messages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    
    // Prova a contattare il backend Python per l'analisi
    try {
      // Per questo possiamo usare l'API del backend direttamente
      const backendResponse = await fetch(`${backendUrl}/api/mood-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Usa la chiave di servizio come token per bypassare l'autenticazione
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          session_id: sessionId,
          analyze_chatbot: true
        })
      });
      
      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        return NextResponse.json({
          mood_analysis: backendData.mood_analysis,
          timestamp: new Date().toISOString(),
          message: 'Analisi umore completata tramite backend (bypass RLS)'
        });
      }
      
      // Se il backend fallisce, crea un'analisi semplificata
      console.log('Server: Backend non disponibile, creando analisi semplificata');
    } catch (backendError) {
      console.error('Server: Errore nel contattare il backend Python:', backendError);
    }
    
    // Analisi semplificata se il backend non è disponibile
    return NextResponse.json({
      mood_analysis: `# Analisi dell'Umore (Semplificata)\n\n**Analisi generata dal server frontend.**\n\nLa conversazione contiene ${messages.length} messaggi.\n\nÈ raccomandata un'analisi più approfondita tramite il backend Python.`,
      timestamp: new Date().toISOString(),
      message: 'Analisi umore semplificata (bypass RLS)'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 