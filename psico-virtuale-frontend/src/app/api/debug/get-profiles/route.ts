import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint di debug per recuperare tutti i profili (bypassando RLS)
export async function GET() {
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

    // Crea un client con la chiave di servizio (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log('Server: Tentativo di recupero profili con chiave di servizio...');
    
    // Recupera tutti i profili
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*');
    
    if (error) {
      console.error('Server: Errore nel recupero profili:', error);
      return NextResponse.json(
        { error: `Errore nel recupero profili: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Recupera le relazioni terapeuta-paziente
    const { data: relations, error: relationsError } = await supabaseAdmin
      .from('therapist_patients')
      .select('*');
    
    if (relationsError) {
      console.error('Server: Errore nel recupero relazioni:', relationsError);
    }

    console.log(`Server: Recuperati ${profiles.length} profili e ${relations?.length || 0} relazioni`);
    
    // Restituisci i profili e le relazioni
    return NextResponse.json({
      profiles,
      relations: relations || [],
      timestamp: new Date().toISOString(),
      message: 'Dati recuperati con successo (bypass RLS)'
    });
    
  } catch (error: any) {
    console.error('Server: Errore generico:', error);
    return NextResponse.json(
      { error: `Errore interno del server: ${error.message}` },
      { status: 500 }
    );
  }
} 