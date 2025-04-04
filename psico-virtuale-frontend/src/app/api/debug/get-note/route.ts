import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per recuperare note sui pazienti (bypassando RLS)
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

    // Ottieni l'ID del paziente dai parametri della richiesta
    const patientId = request.nextUrl.searchParams.get('patient_id');
    
    if (!patientId) {
      return NextResponse.json(
        { error: 'ID paziente richiesto' },
        { status: 400 }
      );
    }

    // Crea un client con la chiave di servizio (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log(`Server: Tentativo di recuperare nota per il paziente ${patientId}`);
    
    // Recupera la nota del paziente
    const { data: note, error: noteError } = await supabaseAdmin
      .from('patient_notes')
      .select('*')
      .eq('patient_id', patientId)
      .single();
      
    if (noteError && noteError.code !== 'PGRST116') { // PGRST116 è "No rows returned", che è ok
      console.error('Server: Errore nel recupero della nota:', noteError);
    }
    
    // Restituisci la nota se trovata, altrimenti restituisci null
    return NextResponse.json({
      success: true,
      note: note || null,
      timestamp: new Date().toISOString(),
      message: note ? 'Nota paziente recuperata con successo' : 'Nessuna nota trovata per questo paziente'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico nel recupero della nota:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 