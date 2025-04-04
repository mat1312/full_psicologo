'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function AddRelation() {
  const [therapistId, setTherapistId] = useState('c133a594-d1b4-4625-a476-b85906e17d61') // ID default del terapeuta loggato
  const [patientId, setPatientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<any[]>([])

  // Funzione per caricare tutti i pazienti
  const loadPatients = async () => {
    try {
      setLoading(true)
      
      // Prima prova a caricare i pazienti tramite API server (bypass RLS)
      console.log('Tentativo di caricamento pazienti tramite API server...')
      try {
        const response = await fetch('/api/debug/get-profiles', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (response.ok) {
          const serverData = await response.json()
          console.log('DEBUG - Profili dal server (bypass RLS):', serverData)
          
          if (serverData.profiles && serverData.profiles.length > 0) {
            // Filtra solo i pazienti (ruolo = patient)
            const patientProfiles = serverData.profiles.filter(
              (profile: any) => profile.role === 'patient'
            )
            
            console.log('DEBUG - Profili pazienti dal server:', patientProfiles)
            
            if (patientProfiles.length > 0) {
              setPatients(patientProfiles)
              setPatientId(patientProfiles[0].id)
              toast.success('Pazienti caricati', { 
                description: `Trovati ${patientProfiles.length} pazienti (bypass RLS)` 
              })
              setLoading(false)
              return
            } else {
              console.log('Nessun paziente trovato tra i profili')
            }
          }
        } else {
          console.error('Errore nel caricamento profili dal server:', await response.text())
        }
      } catch (serverError) {
        console.error('Errore nella chiamata al server:', serverError)
      }
      
      // Fallback al caricamento diretto (probabilmente fallirà a causa di RLS)
      console.log('Fallback al caricamento diretto da Supabase...')
      
      // Prima recuperiamo TUTTI i profili per debug
      console.log('Tentativo di caricamento pazienti...')
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('*')
      
      console.log('DEBUG - Tutti i profili:', allProfiles, 'Error:', allProfilesError)
      
      // Poi proviamo con il filtro role='patient'
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .eq('role', 'patient')
      
      console.log('DEBUG - Profili pazienti:', data, 'Error:', error)
      
      // Proviamo anche con altre possibili varianti del ruolo
      const { data: altRoleProfiles, error: altRoleError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .or('role.eq.patient,role.eq.paziente,role.eq.Patient')
      
      console.log('DEBUG - Profili con ruoli alternativi:', altRoleProfiles, 'Error:', altRoleError)
      
      if (error) throw error
      
      // Usa i risultati standard SE presenti, altrimenti prova con quelli alternativi
      let patientsToShow = data || [];
      
      if (patientsToShow.length === 0 && altRoleProfiles && altRoleProfiles.length > 0) {
        console.log('Usando profili con ruoli alternativi')
        patientsToShow = altRoleProfiles;
      }
      
      setPatients(patientsToShow)
      
      // Aggiorna il campo dell'ID paziente se ci sono pazienti
      if (patientsToShow.length > 0) {
        setPatientId(patientsToShow[0].id)
        toast.success('Pazienti caricati', { description: `Trovati ${patientsToShow.length} pazienti` })
      } else {
        // Se ancora non ci sono pazienti, mostriamo un messaggio diverso
        if (allProfiles && allProfiles.length > 0) {
          console.log('Trovati profili ma nessun paziente. Ruoli disponibili:', 
            [...new Set(allProfiles.map(p => p.role))])
          toast.warning('Nessun paziente trovato', { 
            description: `Trovati ${allProfiles.length} profili ma nessun paziente` 
          })
        } else {
          toast.error('Nessun profilo trovato', { 
            description: 'Nessun profilo trovato nella tabella profiles' 
          })
        }
      }
    } catch (error: any) {
      console.error('Errore nel caricamento pazienti:', error)
      toast.error('Errore', { description: error.message || 'Impossibile caricare i pazienti' })
    } finally {
      setLoading(false)
    }
  }

  // Funzione per aggiungere la relazione
  const addRelation = async () => {
    if (!therapistId || !patientId) {
      toast.error('Errore', { description: 'ID terapeuta e paziente richiesti' })
      return
    }
    
    try {
      setLoading(true)
      
      // Prima tenta di aggiungere la relazione tramite API server (bypass RLS)
      console.log('Tentativo di aggiunta relazione tramite API server...')
      
      const response = await fetch('/api/debug/add-relation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapist_id: therapistId,
          patient_id: patientId
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        console.log('Risposta aggiunta relazione:', result)
        toast.success('Relazione aggiunta', { 
          description: result.message || 'Relazione aggiunta con successo tramite server'
        })
        
        // Mostra tutti i record nella tabella
        if (result.allRelations) {
          console.log('Tutte le relazioni dopo inserimento:', result.allRelations)
        }
        
        return
      } else {
        console.error('Errore dal server:', result)
        toast.error('Errore server', { 
          description: result.error || 'Errore nell\'aggiunta della relazione tramite server'
        })
      }
      
      // Fallback all'inserimento diretto (probabilmente fallirà per RLS)
      console.log('Fallback all\'inserimento diretto...')
      
      // Verifica se esiste già la relazione
      const { data: existingRelation } = await supabase
        .from('therapist_patients')
        .select('*')
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()
      
      if (existingRelation) {
        toast.info('Relazione esistente', { description: 'Questa relazione esiste già' })
        return
      }
      
      // Inserisci la relazione
      const { data, error } = await supabase
        .from('therapist_patients')
        .insert([
          { therapist_id: therapistId, patient_id: patientId }
        ])
      
      if (error) throw error
      
      toast.success('Relazione aggiunta', { 
        description: `Terapeuta ${therapistId} collegato al paziente ${patientId}` 
      })
      
      // Mostra tutti i record nella tabella
      const { data: allRelations, error: relError } = await supabase
        .from('therapist_patients')
        .select('*')
      
      console.log('Tutte le relazioni dopo inserimento:', allRelations)
      
    } catch (error: any) {
      console.error('Errore nell\'aggiunta relazione:', error)
      toast.error('Errore', { description: error.message || 'Impossibile aggiungere la relazione' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Aggiungi Relazione Terapeuta-Paziente</CardTitle>
          <CardDescription>
            Collega un paziente al terapeuta per visualizzarlo nella dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">ID Terapeuta</label>
            <Input 
              value={therapistId} 
              onChange={(e) => setTherapistId(e.target.value)}
              placeholder="ID terapeuta"
            />
            <p className="text-xs text-gray-500 mt-1">
              ID del terapeuta attualmente autenticato
            </p>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium">ID Paziente</label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadPatients}
                disabled={loading}
              >
                Carica pazienti
              </Button>
            </div>
            
            {patients.length > 0 ? (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name} ({patient.email})
                  </option>
                ))}
              </select>
            ) : (
              <Input 
                value={patientId} 
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="ID paziente"
              />
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={addRelation}
            disabled={loading || !therapistId || !patientId}
          >
            {loading ? 'Aggiunta in corso...' : 'Aggiungi Relazione'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 