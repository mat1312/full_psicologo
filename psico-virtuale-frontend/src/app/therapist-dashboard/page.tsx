'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiClient } from '@/lib/apiClient'
import { toast } from 'sonner'
import { 
  Users, 
  BarChart4, 
  BrainCircuit,
  Microscope,
  Search,
  Filter,
  CalendarDays,
  Clock,
  UserCircle,
  FileEdit,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  BadgeInfo,
  PlusCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

// Interfaccia per i dati del paziente
interface Patient {
  id: string
  email: string
  first_name?: string
  last_name?: string
  created_at: string
  last_session?: string
  sessions_count?: number
  status?: 'active' | 'inactive'
  note?: string
  sessions?: Array<{
    id: string
    created_at: string
    last_updated: string
    title?: string
  }>
}

export default function TherapistDashboardPage() { 
  const { user, loading, signOut } = useAuthStore()
  const router = useRouter()
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [sessionSummary, setSessionSummary] = useState<string>('')
  const [moodAnalysis, setMoodAnalysis] = useState<string>('')
  const [pathologyAnalysis, setPathologyAnalysis] = useState<any>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [patientNote, setPatientNote] = useState('')
  const [stats, setStats] = useState({
    totalPatients: 0,
    activePatientsPercent: 0,
    totalSessions: 0,
    avgSessionsPerPatient: 0
  })
  const [isLoading, setIsLoading] = useState({
    patients: false,
    summary: false,
    mood: false,
    pathology: false,
    saveNote: false
  })

  useEffect(() => {
    // Reindirizza se l'utente non è autenticato o non è un terapeuta
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else if (user.role !== 'therapist') {
        router.push('/patient-dashboard')
      } else {
        // Carica i pazienti
        fetchPatients()
      }
    }
  }, [user, loading, router])

  useEffect(() => {
    if (patients.length > 0) {
      filterPatients()
    }
  }, [searchQuery, statusFilter, patients])

  const filterPatients = () => {
    let filtered = [...patients]

    // Filtra per query di ricerca
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(patient => 
        (patient.first_name?.toLowerCase().includes(query) || false) || 
        (patient.last_name?.toLowerCase().includes(query) || false) || 
        patient.email.toLowerCase().includes(query)
      )
    }

    // Filtra per stato
    if (statusFilter !== 'all') {
      filtered = filtered.filter(patient => patient.status === statusFilter)
    }

    setFilteredPatients(filtered)
  }

  const fetchPatients = async () => {
    setIsLoading(prev => ({ ...prev, patients: true }))
    try {
      // Ottieni i pazienti dal database
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'patient')
      
      if (error) throw error
      
      // Ottieni le sessioni per ogni paziente
      const patientsWithSessions = await Promise.all(
        data.map(async (patient) => {
          const { data: sessions, error: sessionsError } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('patient_id', patient.id)
            .order('last_updated', { ascending: false })
          
          // Ottieni la nota relativa al paziente
          const { data: notes, error: notesError } = await supabase
            .from('patient_notes')
            .select('*')
            .eq('patient_id', patient.id)
            .single()
          
          const sessionsData = sessionsError ? [] : sessions
          const lastSessionDate = sessionsData[0]?.last_updated || null
          
          // Determina lo stato del paziente (attivo se ha una sessione negli ultimi 30 giorni)
          const isActive = lastSessionDate ? 
            (new Date().getTime() - new Date(lastSessionDate).getTime()) < 30 * 24 * 60 * 60 * 1000 
            : false
          
          return {
            ...patient,
            sessions: sessionsData,
            sessions_count: sessionsData.length,
            last_session: lastSessionDate,
            status: isActive ? 'active' : 'inactive',
            note: notes?.content || ''
          }
        })
      )
      
      // Calcola le statistiche
      const totalPatients = patientsWithSessions.length
      const activePatients = patientsWithSessions.filter(p => p.status === 'active').length
      const totalSessions = patientsWithSessions.reduce((acc, p) => acc + (p.sessions_count || 0), 0)
      
      setStats({
        totalPatients,
        activePatientsPercent: totalPatients > 0 ? Math.round((activePatients / totalPatients) * 100) : 0,
        totalSessions,
        avgSessionsPerPatient: totalPatients > 0 ? Math.round(totalSessions / totalPatients * 10) / 10 : 0
      })
      
      setPatients(patientsWithSessions)
      setFilteredPatients(patientsWithSessions)
    } catch (error) {
      console.error('Errore nel recupero dei pazienti:', error)
      toast.error('Errore', { description: 'Impossibile recuperare i pazienti' })
    } finally {
      setIsLoading(prev => ({ ...prev, patients: false }))
    }
  }

  const fetchSessionSummary = async (sessionId: string) => {
    setIsLoading(prev => ({ ...prev, summary: true }))
    try {
      const response = await apiClient.getSessionSummary(sessionId)
      setSessionSummary(response.summary_html)
    } catch (error) {
      console.error('Errore nel recupero del riepilogo della sessione:', error)
      toast.error('Errore', { description: 'Impossibile recuperare il riepilogo della sessione' })
    } finally {
      setIsLoading(prev => ({ ...prev, summary: false }))
    }
  }

  const fetchMoodAnalysis = async (sessionId: string) => {
    setIsLoading(prev => ({ ...prev, mood: true }))
    try {
      const response = await apiClient.getMoodAnalysis(sessionId)
      setMoodAnalysis(response.mood_analysis)
    } catch (error) {
      console.error('Errore nell\'analisi dell\'umore:', error)
      toast.error('Errore', { description: 'Impossibile recuperare l\'analisi dell\'umore' })
    } finally {
      setIsLoading(prev => ({ ...prev, mood: false }))
    }
  }

  const fetchPathologyAnalysis = async (sessionId: string) => {
    setIsLoading(prev => ({ ...prev, pathology: true }))
    try {
      const response = await apiClient.getPathologyAnalysis(sessionId)
      setPathologyAnalysis(response)
    } catch (error) {
      console.error('Errore nell\'analisi delle patologie:', error)
      toast.error('Errore', { description: 'Impossibile recuperare l\'analisi delle patologie' })
    } finally {
      setIsLoading(prev => ({ ...prev, pathology: false }))
    }
  }

  const handleSelectSession = (sessionId: string) => {
    setSelectedSession(sessionId)
    // Carica i dati della sessione
    fetchSessionSummary(sessionId)
    fetchMoodAnalysis(sessionId)
    fetchPathologyAnalysis(sessionId)
  }

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setPatientNote(patient.note || '')
    setEditingNote(false)
    setSelectedSession(null)
  }

  const savePatientNote = async () => {
    if (!selectedPatient) return
    
    setIsLoading(prev => ({ ...prev, saveNote: true }))
    try {
      // Controlla se esiste già una nota per questo paziente
      const { data, error } = await supabase
        .from('patient_notes')
        .select('*')
        .eq('patient_id', selectedPatient.id)
      
      if (error) throw error
      
      // Se esiste, aggiorna la nota esistente, altrimenti crea una nuova nota
      if (data && data.length > 0) {
        await supabase
          .from('patient_notes')
          .update({ content: patientNote })
          .eq('patient_id', selectedPatient.id)
      } else {
        await supabase
          .from('patient_notes')
          .insert({ patient_id: selectedPatient.id, content: patientNote })
      }
      
      // Aggiorna la lista pazienti con la nuova nota
      setPatients(patients.map(p => 
        p.id === selectedPatient.id ? { ...p, note: patientNote } : p
      ))
      
      toast.success('Nota salvata', { description: 'La nota è stata salvata con successo' })
      setEditingNote(false)
    } catch (error) {
      console.error('Errore nel salvataggio della nota:', error)
      toast.error('Errore', { description: 'Impossibile salvare la nota' })
    } finally {
      setIsLoading(prev => ({ ...prev, saveNote: false }))
    }
  }

  // Mostra il loader mentre verifichiamo l'autenticazione
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header e Stats */}
      <div className="mb-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard Terapeuta</h1>
          <Button variant="outline" onClick={() => signOut()}>Logout</Button>
        </div>
        
        {/* Statistiche generali */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pazienti totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPatients}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pazienti attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePatientsPercent}%</div>
              <p className="text-xs text-muted-foreground">Attivi negli ultimi 30 giorni</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessioni totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Media sessioni</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgSessionsPerPatient}</div>
              <p className="text-xs text-muted-foreground">Sessioni per paziente</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista pazienti con ricerca e filtri */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              I tuoi pazienti
            </CardTitle>
            <CardDescription>
              Gestisci i tuoi pazienti e visualizza le loro sessioni
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca paziente..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={statusFilter === 'all' ? 'default' : 'outline'} 
                onClick={() => setStatusFilter('all')}
                className="flex-1 text-xs"
              >
                Tutti
              </Button>
              <Button 
                size="sm" 
                variant={statusFilter === 'active' ? 'default' : 'outline'} 
                onClick={() => setStatusFilter('active')}
                className="flex-1 text-xs"
              >
                Attivi
              </Button>
              <Button 
                size="sm" 
                variant={statusFilter === 'inactive' ? 'default' : 'outline'} 
                onClick={() => setStatusFilter('inactive')}
                className="flex-1 text-xs"
              >
                Inattivi
              </Button>
            </div>
            
            <Separator />
            
            {isLoading.patients ? (
              <p className="text-center py-4">Caricamento pazienti...</p>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-gray-500">Nessun paziente trovato</p>
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                    Cancella ricerca
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedPatient?.id === patient.id 
                        ? 'bg-blue-100 dark:bg-blue-900/20' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
                    }`}
                    onClick={() => handleSelectPatient(patient)}
                  >
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-8 w-8 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {patient.first_name 
                            ? `${patient.first_name} ${patient.last_name || ''}` 
                            : patient.email}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <CalendarDays className="h-3 w-3" />
                          <span>
                            {patient.sessions_count || 0} sessioni
                          </span>
                        </div>
                      </div>
                      <Badge variant={patient.status === 'active' ? 'default' : 'outline'}>
                        {patient.status === 'active' ? 'Attivo' : 'Inattivo'}
                      </Badge>
                    </div>
                    {patient.last_session && (
                      <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Ultima sessione: {new Date(patient.last_session).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => toast.info('Funzionalità in arrivo', { description: 'La possibilità di aggiungere nuovi pazienti sarà disponibile presto.' })}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Aggiungi paziente
            </Button>
          </CardFooter>
        </Card>

        {/* Dettagli paziente e sessioni */}
        <div className="lg:col-span-3 space-y-6">
          {selectedPatient ? (
            <>
              {/* Informazioni sul paziente */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">
                        {selectedPatient.first_name 
                          ? `${selectedPatient.first_name} ${selectedPatient.last_name || ''}`
                          : selectedPatient.email}
                      </CardTitle>
                      <CardDescription>
                        Email: {selectedPatient.email}
                      </CardDescription>
                    </div>
                    <Badge variant={selectedPatient.status === 'active' ? 'default' : 'outline'} className="ml-auto">
                      {selectedPatient.status === 'active' ? 'Attivo' : 'Inattivo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground mb-1">Data registrazione</div>
                      <div>{new Date(selectedPatient.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground mb-1">Sessioni totali</div>
                      <div>{selectedPatient.sessions_count || 0}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground mb-1">Ultima attività</div>
                      <div>
                        {selectedPatient.last_session 
                          ? new Date(selectedPatient.last_session).toLocaleDateString() 
                          : 'Nessuna sessione'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Note sul paziente */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium flex items-center">
                        <FileEdit className="h-4 w-4 mr-2" />
                        Note sul paziente
                      </div>
                      {!editingNote ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setEditingNote(true)}
                        >
                          Modifica
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setEditingNote(false)
                              setPatientNote(selectedPatient.note || '')
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Annulla
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={savePatientNote} 
                            disabled={isLoading.saveNote}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Salva
                          </Button>
                        </div>
                      )}
                    </div>
                    {editingNote ? (
                      <div className="mt-2">
                        <textarea
                          value={patientNote}
                          onChange={(e) => setPatientNote(e.target.value)}
                          className="w-full min-h-[100px] p-2 border rounded-md"
                          placeholder="Inserisci note sul paziente..."
                        />
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">
                        {selectedPatient.note ? (
                          <p className="whitespace-pre-line">{selectedPatient.note}</p>
                        ) : (
                          <p className="text-gray-500 italic">Nessuna nota disponibile. Clicca su "Modifica" per aggiungere una nota.</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Sessioni del paziente */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Sessioni di {selectedPatient.first_name || selectedPatient.email}
                  </CardTitle>
                  <CardDescription>
                    Seleziona una sessione per visualizzare i dettagli
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedPatient.sessions || selectedPatient.sessions.length === 0 ? (
                    <div className="text-center py-10 border border-dashed rounded-lg">
                      <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <p className="text-gray-500">
                        Nessuna sessione disponibile per questo paziente
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedPatient.sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedSession === session.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                          onClick={() => handleSelectSession(session.id)}
                        >
                          <h3 className="font-medium">
                            {session.title || `Sessione ${new Date(session.created_at).toLocaleDateString()}`}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {new Date(session.created_at).toLocaleDateString()}
                            </Badge>
                            {new Date(session.created_at).toDateString() !== 
                             new Date(session.last_updated).toDateString() && (
                              <Badge variant="outline" className="text-xs">
                                Aggiornata: {new Date(session.last_updated).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Analisi della sessione */}
              {selectedSession && (
                <Card>
                  <CardHeader>
                    <CardTitle>Analisi della sessione</CardTitle>
                    <CardDescription>
                      Riepilogo e analisi della sessione selezionata
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="summary">
                      <TabsList className="mb-4">
                        <TabsTrigger value="summary" className="flex items-center">
                          <BadgeInfo className="h-4 w-4 mr-2" />
                          Riepilogo
                        </TabsTrigger>
                        <TabsTrigger value="mood" className="flex items-center">
                          <BarChart4 className="h-4 w-4 mr-2" />
                          Analisi umore
                        </TabsTrigger>
                        <TabsTrigger value="pathology" className="flex items-center">
                          <Microscope className="h-4 w-4 mr-2" />
                          Analisi patologie
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="summary" className="mt-0">
                        {isLoading.summary ? (
                          <div className="text-center py-8">
                            <p>Caricamento riepilogo...</p>
                          </div>
                        ) : (
                          <div 
                            className="prose prose-blue dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: sessionSummary }}
                          />
                        )}
                      </TabsContent>
                      
                      <TabsContent value="mood" className="mt-0">
                        {isLoading.mood ? (
                          <div className="text-center py-8">
                            <p>Caricamento analisi dell'umore...</p>
                          </div>
                        ) : (
                          <div 
                            className="prose prose-blue dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: moodAnalysis }}
                          />
                        )}
                      </TabsContent>
                      
                      <TabsContent value="pathology" className="mt-0">
                        {isLoading.pathology ? (
                          <div className="text-center py-8">
                            <p>Caricamento analisi delle patologie...</p>
                          </div>
                        ) : pathologyAnalysis ? (
                          <div className="space-y-6">
                            <div className="prose prose-blue dark:prose-invert max-w-none">
                              <h3>Riepilogo dell'analisi</h3>
                              <p>{pathologyAnalysis.analysis_summary}</p>
                            </div>
                            
                            <div>
                              <h3 className="text-lg font-medium mb-4">Possibili patologie rilevate</h3>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {pathologyAnalysis.possible_pathologies.map((pathology: any, index: number) => (
                                  <div key={index} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-medium">{pathology.name}</h4>
                                      <Badge>
                                        {Math.round(pathology.confidence * 100)}%
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                                      {pathology.description}
                                    </p>
                                    <div>
                                      <h5 className="text-sm font-medium mb-1">Sintomi chiave:</h5>
                                      <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                                        {pathology.key_symptoms.map((symptom: string, symIdx: number) => (
                                          <li key={symIdx}>{symptom}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    {pathology.source && (
                                      <div className="mt-2 text-xs text-gray-500">
                                        Fonte: {pathology.source}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            Nessuna analisi disponibile
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center py-10 px-6 max-w-md mx-auto">
                <UserCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Seleziona un paziente</h3>
                <p className="text-gray-500 mb-6">
                  Seleziona un paziente dalla lista per visualizzare i dettagli e le sessioni
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm">Visualizza le sessioni dei pazienti</span>
                  </div>
                  <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm">Gestisci le note sui pazienti</span>
                  </div>
                  <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm">Analizza le sessioni di terapia</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}