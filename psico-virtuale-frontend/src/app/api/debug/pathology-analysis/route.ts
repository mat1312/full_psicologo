import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per l'analisi delle patologie (bypassando RLS)
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

    console.log(`Server: Analisi delle patologie per sessione ${sessionId}`);
    
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
        possible_pathologies: [],
        analysis_summary: "Dati insufficienti per l'analisi. Non ci sono conversazioni disponibili da analizzare."
      });
    }
    
    // Verifica che ci siano abbastanza messaggi dell'utente per un'analisi significativa
    const userMessages = messages.filter(msg => msg.role === 'user');
    const totalUserWords = userMessages.reduce((total, msg) => 
      total + (msg.content ? msg.content.split(/\s+/).length : 0), 0);
    
    // Requisiti minimi per un'analisi significativa
    const MIN_USER_MESSAGES = 1;
    const MIN_USER_WORDS = 10;
    
    if (userMessages.length < MIN_USER_MESSAGES || totalUserWords < MIN_USER_WORDS) {
      return NextResponse.json({
        possible_pathologies: [],
        analysis_summary: `Dati insufficienti per un'analisi clinica significativa. Sono necessari almeno ${MIN_USER_MESSAGES} messaggi e ${MIN_USER_WORDS} parole dall'utente per procedere. Attualmente: ${userMessages.length} messaggi, ${totalUserWords} parole.`
      });
    }
    
    // Prova a contattare il backend Python per l'analisi
    try {
      // Per questo possiamo usare l'API del backend direttamente
      const backendResponse = await fetch(`${backendUrl}/api/pathology-analysis`, {
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
          ...backendData,
          timestamp: new Date().toISOString(),
          message: 'Analisi patologie completata tramite backend (bypass RLS)'
        });
      }
      
      // Se il backend fallisce, crea un'analisi semplificata
      console.log('Server: Backend non disponibile, creando analisi semplificata');
    } catch (backendError) {
      console.error('Server: Errore nel contattare il backend Python:', backendError);
    }
    
    // Analisi semplificata se il backend non è disponibile
    return NextResponse.json({
      possible_pathologies: [],
      analysis_summary: `Analisi generata dal server frontend (fallback). La conversazione contiene ${messages.length} messaggi, di cui ${userMessages.length} dall'utente. L'accesso al servizio di analisi backend non è disponibile, quindi non è possibile fornire un'analisi dettagliata delle possibili patologie. Si consiglia di riprovare più tardi quando il servizio sarà disponibile.`,
      timestamp: new Date().toISOString(),
      message: 'Analisi patologie semplificata (bypass RLS)'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 