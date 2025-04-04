import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per salvare note sui pazienti (bypassando RLS)
export async function POST(request: NextRequest) {
  try {
    // Debug environment variables
    console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not Set");
    console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set (length: " + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "Not Set");
    
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
    const { patient_id, content, therapist_id } = requestData;
    
    if (!patient_id || content === undefined) {
      return NextResponse.json(
        { error: 'ID paziente e contenuto della nota richiesti' },
        { status: 400 }
      );
    }

    // Crea un client con la chiave di servizio (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log(`Server: Tentativo di salvare nota per il paziente ${patient_id}`);
    
    // Verifica l'esistenza del paziente
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
    
    // Verifica se esiste già una nota per questo paziente
    const { data: existingNote, error: existingError } = await supabaseAdmin
      .from('patient_notes')
      .select('*')
      .eq('patient_id', patient_id);
      
    if (existingError) {
      console.error('Server: Errore nella verifica della nota esistente:', existingError);
    }
    
    let noteResult;
    
    // Se esiste, aggiorna la nota esistente, altrimenti crea una nuova
    if (existingNote && existingNote.length > 0) {
      const { data: updatedNote, error: updateError } = await supabaseAdmin
        .from('patient_notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('patient_id', patient_id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Server: Errore nell\'aggiornamento della nota:', updateError);
        return NextResponse.json(
          { error: `Errore nell'aggiornamento della nota: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      noteResult = updatedNote;
      console.log('Server: Nota aggiornata con successo:', updatedNote);
    } else {
      // Crea una nuova nota
      const noteData: Record<string, any> = {
        patient_id,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Se fornito, aggiungi anche il terapeuta
      if (therapist_id) {
        noteData['therapist_id'] = therapist_id;
      }
      
      const { data: newNote, error: insertError } = await supabaseAdmin
        .from('patient_notes')
        .insert([noteData])
        .select()
        .single();
      
      if (insertError) {
        console.error('Server: Errore nell\'inserimento della nota:', insertError);
        return NextResponse.json(
          { error: `Errore nell'inserimento della nota: ${insertError.message}` },
          { status: 500 }
        );
      }
      
      noteResult = newNote;
      console.log('Server: Nota creata con successo:', newNote);
    }
    
    // Recupera tutte le note per questo paziente
    const { data: allNotes, error: allNotesError } = await supabaseAdmin
      .from('patient_notes')
      .select('*')
      .eq('patient_id', patient_id);
    
    // Restituisci la nota
    return NextResponse.json({
      success: true,
      note: noteResult,
      allNotes: allNotes || [],
      timestamp: new Date().toISOString(),
      message: 'Nota salvata con successo (bypass RLS)'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico nel salvataggio della nota:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 