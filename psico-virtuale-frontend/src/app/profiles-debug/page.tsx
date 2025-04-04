'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function ProfilesDebugPage() {
  const { user } = useAuthStore()
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [relations, setRelations] = useState<any[]>([])
  const [loadingRelations, setLoadingRelations] = useState(false)

  // Carica tutti i profili all'avvio
  useEffect(() => {
    if (user) {
      loadAllProfiles()
      loadAllRelations()
    }
  }, [user])

  const loadAllProfiles = async () => {
    try {
      setLoading(true)
      
      // Registra informazioni sulla sessione
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('DEBUG - Sessione corrente:', sessionData)
      
      // 1. Prova a recuperare usando la query standard
      console.log('1. Tentativo query standard...')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
      
      console.log('DEBUG - Tutti i profili (query standard):', data, 'Error:', error)
      
      // 2. Prova a recuperare senza RLS tramite API server
      console.log('2. Prova a recuperare profili tramite server...')
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
          
          // Usa i dati dal server se disponibili
          if (serverData.profiles && serverData.profiles.length > 0) {
            setProfiles(serverData.profiles)
            
            // Raggruppa i profili per ruolo
            const roleGroups: Record<string, number> = {}
            serverData.profiles.forEach((profile: any) => {
              const role = profile.role || 'no_role'
              roleGroups[role] = (roleGroups[role] || 0) + 1
            })
            
            console.log('DEBUG - Distribuzione ruoli (dal server):', roleGroups)
            
            toast.success('Profili caricati dal server', {
              description: `${serverData.profiles.length} profili trovati (con bypass RLS)`
            })
            
            setLoading(false)
            return
          }
        } else {
          console.error('Errore nel recupero profili dal server:', await response.text())
        }
      } catch (serverError) {
        console.error('Errore nella chiamata al server:', serverError)
      }
      
      // 3. Se non esistono dati dal server, usa i dati originali
      if (!data || data.length === 0) {
        toast.error('Nessun profilo trovato', {
          description: 'Le policy RLS potrebbero bloccare l\'accesso'
        })
        setProfiles([])
      } else {
        setProfiles(data)
        
        // Raggruppa i profili per ruolo per debug
        const roleGroups: Record<string, number> = {}
        data.forEach(profile => {
          const role = profile.role || 'no_role'
          roleGroups[role] = (roleGroups[role] || 0) + 1
        })
        
        console.log('DEBUG - Distribuzione ruoli:', roleGroups)
      }
      
    } catch (error: any) {
      console.error('Errore nel caricamento profili:', error)
      toast.error('Errore', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const loadAllRelations = async () => {
    try {
      setLoadingRelations(true)
      const { data, error } = await supabase
        .from('therapist_patients')
        .select('*')
      
      if (error) throw error
      
      // Ensure we have valid data before setting state
      if (data && Array.isArray(data)) {
        // Filter out any potentially invalid records
        const validRelations = data.filter(rel => rel && typeof rel === 'object')
        setRelations(validRelations)
        console.log('Relations loaded:', validRelations.length)
      } else {
        setRelations([])
        console.log('No relations found or invalid data format')
      }
      
    } catch (error: any) {
      console.error('Errore nel caricamento relazioni:', error)
      setRelations([])
    } finally {
      setLoadingRelations(false)
    }
  }

  const addRelation = async (patientId: string) => {
    if (!user?.id) {
      toast.error('Errore', { description: 'Devi essere autenticato come terapeuta' })
      return
    }
    
    try {
      setLoading(true)
      
      // Verifica se esiste già localmente
      const existingRelation = relations.find(
        rel => rel?.therapist_id === user.id && rel?.patient_id === patientId
      )
      
      if (existingRelation) {
        toast.info('Relazione esistente', { description: 'Questa relazione esiste già localmente' })
      }
      
      // Prima prova con la nuova API server (che bypassa RLS)
      toast.info('Aggiunta relazione...', { description: 'Tentativo di aggiunta relazione tramite server' })
      
      const response = await fetch('/api/debug/add-relation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapist_id: user.id,
          patient_id: patientId
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        console.log('Risposta aggiunta relazione:', result)
        toast.success('Relazione aggiunta', { 
          description: result.message || 'Relazione aggiunta con successo tramite server'
        })
        
        // Aggiorna le relazioni con tutte le relazioni restituite dal server
        if (result.allRelations && Array.isArray(result.allRelations)) {
          // Filter out any potentially invalid records
          const validRelations = result.allRelations.filter((rel: any) => rel && typeof rel === 'object')
          setRelations(validRelations)
        } else if (result.relation && typeof result.relation === 'object') {
          // Make sure we don't add duplicates
          const relationExists = relations.some(
            rel => rel?.therapist_id === result.relation.therapist_id && 
                  rel?.patient_id === result.relation.patient_id
          )
          
          if (!relationExists) {
            setRelations([...relations, result.relation])
          }
        }
        
        return
      } else {
        console.error('Errore dal server:', result)
        toast.error('Errore server', { 
          description: result.error || 'Errore nell\'aggiunta della relazione tramite server'
        })
      }
      
      // Se fallisce il server, prova con Supabase diretto (ma probabilmente fallirà per RLS)
      console.log('Fallback a inserimento diretto Supabase...')
      const { data, error } = await supabase
        .from('therapist_patients')
        .insert([
          { therapist_id: user.id, patient_id: patientId }
        ])
      
      if (error) {
        console.error('Errore Supabase:', error)
        throw error
      }
      
      toast.success('Relazione aggiunta tramite Supabase', { 
        description: `Terapeuta collegato al paziente`
      })
      
      // Ricarica le relazioni
      loadAllRelations()
      
    } catch (error: any) {
      console.error('Errore nell\'aggiunta relazione:', error)
      toast.error('Errore', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Debug profili e relazioni</CardTitle>
          <CardDescription>
            Visualizza tutti i profili e le relazioni nel database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-4">
            <div>
              <p className="text-sm">
                Profili totali: <strong>{profiles.length}</strong>
              </p>
              <p className="text-sm">
                Terapeuta corrente: <strong>{user?.id}</strong>
              </p>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={loadAllProfiles}
                disabled={loading}
              >
                Ricarica profili
              </Button>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Relazioni terapeuta-paziente</h3>
            {loadingRelations ? (
              <p>Caricamento relazioni...</p>
            ) : relations.length === 0 ? (
              <p className="text-amber-500">Nessuna relazione trovata</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {relations.map((rel, idx) => (
                  <li key={idx} className="text-sm">
                    Terapeuta: <code className="bg-gray-100 p-1 rounded">{rel?.therapist_id || 'N/A'}</code> → 
                    Paziente: <code className="bg-gray-100 p-1 rounded">{rel?.patient_id || 'N/A'}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p>Caricamento profili...</p>
        ) : profiles.length === 0 ? (
          <p>Nessun profilo trovato</p>
        ) : (
          profiles.map(profile => (
            <Card key={profile.id} className={selectedProfile === profile.id ? "border-blue-500" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{profile.email}</CardTitle>
                <CardDescription>
                  ID: <code className="text-xs">{profile.id}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <div className="font-medium">Nome:</div>
                  <div>{profile.first_name || '-'}</div>
                  
                  <div className="font-medium">Cognome:</div>
                  <div>{profile.last_name || '-'}</div>
                  
                  <div className="font-medium">Ruolo:</div>
                  <div>
                    <span className={`px-2 py-1 rounded text-xs 
                      ${profile.role === 'therapist' ? 'bg-blue-100 text-blue-800' : 
                        profile.role === 'patient' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                      {profile.role || 'Nessuno'}
                    </span>
                  </div>
                  
                  <div className="font-medium">Creato:</div>
                  <div>{new Date(profile.created_at).toLocaleDateString()}</div>
                </div>
              </CardContent>
              <CardFooter>
                {user?.id !== profile.id && (
                  <Button 
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => addRelation(profile.id)}
                    disabled={loading || relations.some(
                      rel => rel?.therapist_id === user?.id && rel?.patient_id === profile.id
                    )}
                  >
                    {relations.some(rel => rel?.therapist_id === user?.id && rel?.patient_id === profile.id)
                      ? "Già collegato"
                      : "Collega come paziente"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
} 