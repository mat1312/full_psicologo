import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per aggiungere relazioni terapeuta-paziente (bypassando RLS)
export async function POST(request: NextRequest) {
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

    // Ottieni i dati dalla richiesta
    const requestData = await request.json();
    const { therapist_id, patient_id } = requestData;
    
    if (!therapist_id || !patient_id) {
      return NextResponse.json(
        { error: 'ID terapeuta e paziente richiesti' },
        { status: 400 }
      );
    }

    // Crea un client con la chiave di servizio (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log(`Server: Tentativo di aggiungere relazione terapeuta ${therapist_id} - paziente ${patient_id}`);
    
    // Verifica l'esistenza di entrambi i profili
    const { data: therapist, error: therapistError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', therapist_id)
      .single();
      
    if (therapistError || !therapist) {
      return NextResponse.json(
        { error: `Terapeuta non trovato: ${therapistError?.message || 'ID non valido'}` },
        { status: 404 }
      );
    }
    
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', patient_id)
      .single();
      
    if (patientError || !patient) {
      return NextResponse.json(
        { error: `Paziente non trovato: ${patientError?.message || 'ID non valido'}` },
        { status: 404 }
      );
    }
    
    // Verifica se esiste già la relazione
    const { data: existingRelation, error: existingError } = await supabaseAdmin
      .from('therapist_patients')
      .select('*')
      .eq('therapist_id', therapist_id)
      .eq('patient_id', patient_id);
      
    if (existingError) {
      console.error('Server: Errore nella verifica della relazione esistente:', existingError);
    }
    
    if (existingRelation && existingRelation.length > 0) {
      return NextResponse.json(
        { message: 'Relazione già esistente', existingRelation: existingRelation[0] },
        { status: 200 }
      );
    }
    
    // Inserisci la relazione
    const { data: newRelation, error: insertError } = await supabaseAdmin
      .from('therapist_patients')
      .insert([{ therapist_id, patient_id }])
      .select()
      .single();
    
    if (insertError) {
      console.error('Server: Errore nell\'inserimento della relazione:', insertError);
      return NextResponse.json(
        { error: `Errore nell'inserimento della relazione: ${insertError.message}` },
        { status: 500 }
      );
    }
    
    console.log('Server: Relazione aggiunta con successo:', newRelation);
    
    // Recupera tutte le relazioni per verificare l'inserimento
    const { data: allRelations, error: allRelationsError } = await supabaseAdmin
      .from('therapist_patients')
      .select('*');
    
    // Restituisci la nuova relazione
    return NextResponse.json({
      success: true,
      relation: newRelation,
      allRelations: allRelations || [],
      timestamp: new Date().toISOString(),
      message: 'Relazione aggiunta con successo (bypass RLS)'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 