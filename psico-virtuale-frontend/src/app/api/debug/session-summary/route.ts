import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per ottenere il riepilogo di una sessione (bypassando RLS)
export async function GET(request: NextRequest) {
  try {
    // Usa la chiave di servizio che bypassa RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
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

    console.log(`Server: Recupero riepilogo per sessione ${sessionId}`);
    
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
        summary_html: "<p>Nessuna sessione disponibile</p>"
      });
    }
    
    // Formatta il riepilogo in HTML
    let html = `
    <div class="p-4 bg-gray-50 rounded-lg">
        <h2 class="text-xl font-semibold mb-4 text-blue-700">Riepilogo della Sessione</h2>
    `;
    
    for (const message of messages) {
      const roleClass = message.role === "assistant" ? "text-blue-600 font-medium" : "text-gray-700 font-medium";
      const roleName = message.role === "assistant" ? "Psicologo" : "Paziente";
      
      html += `
      <div class="mb-4 pb-3 border-b border-gray-200">
          <div class="mb-1"><span class="${roleClass}">${roleName}:</span></div>
          <p class="pl-2">${message.content}</p>
      </div>
      `;
    }
    
    html += "</div>";
    
    // Recupera anche i dati dell'umore se disponibili
    const { data: moodData, error: moodError } = await supabaseAdmin
      .from('mood_data')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (!moodError && moodData && moodData.length > 0) {
      html += `
      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 class="text-lg font-semibold mb-2 text-blue-700">Tracciamento dell'Umore</h3>
          <div class="mood-chart">
              <p>Trend dell'umore rilevato durante la sessione.</p>
              <ul class="list-disc pl-5 mt-2">
      `;
      
      for (const mood of moodData) {
        const date = new Date(mood.created_at).toLocaleString();
        html += `<li>${date}: ${mood.mood}</li>`;
      }
      
      html += `
              </ul>
          </div>
      </div>
      `;
    }
    
    return NextResponse.json({
      summary_html: html,
      timestamp: new Date().toISOString(),
      message: 'Riepilogo della sessione recuperato con successo (bypass RLS)'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 