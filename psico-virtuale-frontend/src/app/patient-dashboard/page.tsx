'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { 
  MessageSquare, 
  Sparkles, 
  Book, 
  User, 
  LogOut, 
  Plus, 
  Clock, 
  BarChart3, 
  Mic, 
  Play,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  Users,
  BrainCircuit,
  Brain,
  HeartPulse,
  Search,
  Filter,
  CalendarDays,
  FileEdit,
  Settings,
  Bell,
  Languages,
  Shield,
  HelpCircle
} from 'lucide-react'
import { apiClient, ChatMessage, ResourceItem } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'
import { Separator } from '@/components/ui/separator'

// Definizione delle interfacce
interface Session {
  id: string
  created_at: string
  last_updated: string
  title?: string
}

interface MoodData {
  date: string;
  value: number;
}

export default function PatientDashboardPage() {
  const { user, loading, signOut } = useAuthStore()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [moodData, setMoodData] = useState<MoodData[]>([])
  const [currentMood, setCurrentMood] = useState<number | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const isComponentMountedRef = useRef<boolean>(true)
  const lastMessageTimeRef = useRef<Date | null>(null)

  // Effetto per impostare e pulire il ref di montaggio
  useEffect(() => {
    isComponentMountedRef.current = true
    
    return () => {
      isComponentMountedRef.current = false
    }
  }, [])
  
  // Effetto per il caricamento iniziale e routing
  useEffect(() => {
    // Reindirizza alla pagina di login se l'utente non è autenticato
    if (!loading && !user) {
      router.push('/login')
    }
    // Reindirizza alla dashboard terapeuta se l'utente è un terapeuta
    if (!loading && user?.role === 'therapist') {
      router.push('/therapist-dashboard')
    }
    
    if (user) {
      fetchSessions()
      fetchMoodData()
    }
  }, [user, loading, router])
  
  // Effetto per caricare i messaggi quando cambia la sessione attiva
  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession)
      setLastUpdated(null) // Reset lastUpdated quando cambia sessione
    }
  }, [activeSession])
  
  // Effetto per il polling periodico dei messaggi
  useEffect(() => {
    if (!activeSession) return
    
    // Funzione per controllare gli aggiornamenti
    const checkForUpdates = async () => {
      // Skip polling if we're currently sending a message to avoid duplicates
      if (isComponentMountedRef.current && !isSending) {
        await fetchMessages(activeSession, lastUpdated ?? undefined) 
      }
    }
    
    // Configura un intervallo per controllare nuovi messaggi ogni 3 secondi
    const intervalId = setInterval(checkForUpdates, 3000)
    
    // Pulisci l'intervallo quando cambia la sessione o il componente viene smontato
    return () => clearInterval(intervalId)
  }, [activeSession, lastUpdated, isSending])

  // Funzione per recuperare le sessioni dell'utente
  const fetchSessions = async () => {
    if (!user) return
    
    setIsLoadingSessions(true)
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('patient_id', user.id)
        .order('last_updated', { ascending: false })
      
      if (error) throw error
      
      setSessions(data || [])
      
      // Se ci sono sessioni e nessuna sessione attiva, imposta la più recente come attiva
      if (data && data.length > 0 && !activeSession) {
        setActiveSession(data[0].id)
        fetchMessages(data[0].id)
      }
    } catch (error) {
      console.error('Errore nel recupero delle sessioni:', error)
      toast.error('Errore nel caricamento delle sessioni')
    } finally {
      setIsLoadingSessions(false)
    }
  }

  // Funzione per recuperare i messaggi di una sessione
  const fetchMessages = async (sessionId: string, lastUpdated?: string) => {
    if (!sessionId) return
    
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
      
      // Se fornito, recupera solo i messaggi più recenti dell'ultimo aggiornamento
      if (lastUpdated) {
        query = query.gt('created_at', lastUpdated)
      }
      
      // Ordina in ordine cronologico
      const { data, error } = await query.order('created_at', { ascending: true })
      
      if (error) throw error
      
      // Se ci sono nuovi messaggi, aggiornali
      if (data && data.length > 0) {
        // Salva il timestamp dell'ultimo messaggio per il prossimo polling
        setLastUpdated(data[data.length - 1].created_at)
        
        // Se questo è un aggiornamento (lastUpdated è definito), aggiungi solo i nuovi messaggi
        if (lastUpdated) {
          // Check if any of these messages are already in our UI (to prevent duplicates)
          const existingContents = messages.map(msg => msg.content);
          
          const formattedNewMessages = data
            .filter(msg => !existingContents.includes(msg.content)) // Only add messages we don't already have
            .map(msg => ({
              role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
              content: msg.content,
              id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: msg.created_at
            }));
          
          if (formattedNewMessages.length > 0) {
            setMessages(prev => [...prev, ...formattedNewMessages as ChatMessage[]]);
          }
        } else {
          // Altrimenti, sostituisci tutti i messaggi
          const formattedMessages = data.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: msg.content,
            id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: msg.created_at
          }));
          
          setMessages(formattedMessages as ChatMessage[])
        }
      }
      
      // Recupera le risorse consigliate solo durante il primo caricamento
      if (!lastUpdated) {
        fetchResources(sessionId)
      }
    } catch (error) {
      console.error('Errore nel recupero dei messaggi:', error)
      if (isComponentMountedRef.current) {
        toast.error('Errore nel caricamento dei messaggi')
      }
    }
  }

  // Disabilita completamente il polling quando non è necessario
  useEffect(() => {
    // Disattiva il polling quando stiamo già inviando un messaggio
    if (isSending) {
      // Resetta il riferimento del tempo dell'ultimo messaggio per evitare che il polling aggiunga duplicati
      lastMessageTimeRef.current = new Date();
    }
  }, [isSending]);

  // Funzione per recuperare le risorse consigliate
  const fetchResources = async (sessionId: string) => {
    if (!sessionId) return;
    
    try {
      // Use the correct parameters order for getResourceRecommendations
      const recommendations = await apiClient.getResourceRecommendations(user?.id || '', sessionId);
      
      // Make sure we're setting a valid array, even if empty
      setResources(recommendations || []);
    } catch (error: any) {
      console.error('Errore nel recupero delle risorse:', error);
      
      // Non mostriamo toast per errori di sessione scaduta 
      // poiché l'apiClient già gestisce la visualizzazione
      if (!error.message?.includes('sessione')) {
        toast.error('Errore nel recupero delle risorse', {
          description: 'Per favore, riprova più tardi'
        });
      }
      
      // Imposta una lista vuota per evitare problemi di rendering
      setResources([]);
    }
  }

  // Funzione per recuperare i dati dell'umore
  const fetchMoodData = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('patient_mood_logs')
        .select('*')
        .eq('patient_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      
      const formattedData: MoodData[] = data.map(item => ({
        date: new Date(item.logged_at).toLocaleDateString(),
        value: item.mood_score
      }))
      
      setMoodData(formattedData)
    } catch (error) {
      console.error('Errore nel recupero dei dati dell\'umore:', error)
    }
  }

  // Funzione per creare una nuova sessione
  const createNewSession = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          patient_id: user.id,
          title: `Sessione ${new Date().toLocaleDateString()}`
        })
        .select()
      
      if (error) throw error
      
      toast.success('Nuova sessione creata')
      
      // Aggiorna la lista delle sessioni
      fetchSessions()
      
      // Imposta la nuova sessione come attiva
      if (data && data.length > 0) {
        setActiveSession(data[0].id)
        setMessages([])
      }
    } catch (error) {
      console.error('Errore nella creazione della sessione:', error)
      toast.error('Errore nella creazione della sessione')
    }
  }

  // Funzione per inviare un messaggio
  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeSession) return
    
    // Prepare unique IDs for messages
    const userMsgId = `user-${Date.now()}`
    const currentTime = new Date().toISOString()
    
    // Aggiunge immediatamente il messaggio dell'utente alla UI
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: inputMessage,
      id: userMsgId,
      timestamp: currentTime
    }
    setMessages(prev => [...prev, userMessage])
    
    // Aggiunge un messaggio di caricamento temporaneo
    const loadingMessage = { 
      role: 'assistant' as 'assistant', 
      content: '...', 
      id: `loading-${Date.now()}`,
      timestamp: currentTime,
      loading: true // Custom property not in the type
    }
    setMessages(prev => [...prev, loadingMessage as any])
    
    // Salviamo il messaggio di input nella UI e lo cancelliamo dall'input
    const messageToSend = inputMessage
    setInputMessage('')
    setIsSending(true)
    
    try {
      // Invia il messaggio all'API usando l'endpoint per la chat paziente
      const moodString = currentMood ? currentMood.toString() : undefined
      const response = await apiClient.sendMessage(messageToSend, activeSession, moodString, true) // true = isPatientChat
      
      // Rimuove il messaggio di caricamento e aggiunge la risposta effettiva
      setMessages(prev => prev.filter((msg: any) => !msg.loading).concat([
        { 
          role: 'assistant', 
          content: response.answer,
          id: `assistant-${Date.now()}`,
          timestamp: response.timestamp || new Date().toISOString()
        }
      ]))
      
      // Aggiorna il timestamp dell'ultimo messaggio per evitare che il polling duplichi i messaggi
      if (response.timestamp) {
        lastMessageTimeRef.current = new Date(response.timestamp);
      } else {
        // Se non c'è timestamp nella risposta, aggiorna comunque il riferimento
        lastMessageTimeRef.current = new Date();
      }
      
      // Se c'è un audio URL, lo salva per la riproduzione
      if (response.audio_url) {
        setAudioUrl(response.audio_url)
      }
      
      // Aggiorna le risorse consigliate
      fetchResources(activeSession)
    } catch (error) {
      console.error('Errore nell\'invio del messaggio:', error)
      // Rimuove il messaggio di caricamento
      setMessages(prev => prev.filter((msg: any) => !msg.loading))
      // Mostra un messaggio di errore visibile nella chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Mi dispiace, si è verificato un errore. Prova a inviare di nuovo il messaggio o ricarica la pagina.',
        id: `error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        isError: true 
      } as any])
      toast.error('Errore nella comunicazione con l\'assistente')
    } finally {
      setIsSending(false)
    }
  }

  // Funzione per riprodurre l'audio
  const playAudio = () => {
    if (!audioUrl) return
    
    const audio = new Audio(audioUrl)
    audio.onplay = () => setIsPlaying(true)
    audio.onended = () => setIsPlaying(false)
    audio.play()
  }

  // Funzione per registrare audio (simulata)
  const toggleRecording = () => {
    setIsRecording(!isRecording)
    
    if (isRecording) {
      // Fine registrazione (simulata)
      toast.info('Registrazione completata')
      setIsRecording(false)
    } else {
      // Inizio registrazione (simulata)
      toast.info('Registrazione in corso...')
      setIsRecording(true)
      
      // Simula fine registrazione dopo 5 secondi
      setTimeout(() => {
        setIsRecording(false)
        toast.info('Registrazione completata')
      }, 5000)
    }
  }

  // Funzione per salvare l'umore attuale
  const saveCurrentMood = async () => {
    if (!user || !currentMood || !activeSession) return
    
    try {
      await supabase
        .from('patient_mood_logs')
        .insert({
          patient_id: user.id,
          mood_score: currentMood,
          notes: `Sessione: ${activeSession}`
        })
      
      toast.success('Umore salvato')
      fetchMoodData()
    } catch (error) {
      console.error('Errore nel salvataggio dell\'umore:', error)
      toast.error('Errore nel salvataggio dell\'umore')
    }
  }

  // Funzione per verificare se ci sono nuovi messaggi dal backend
  const pollForNewMessages = useCallback(async () => {
    // This functionality is now handled by the checkForUpdates function
    // Keep this function as a stub to avoid changing too many references
    return;
  }, [activeSession, isSending, supabase, messages.length]);

  // Avvia il polling - disabled to prevent duplicate messages
  useEffect(() => {
    // This polling is disabled to prevent duplicate messages
    // The checkForUpdates function is now handling all polling
    return;
  }, [activeSession, pollForNewMessages]);

  // Mostra il loader mentre verifichiamo l'autenticazione
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-amber-50 dark:from-gray-950 dark:via-indigo-950/30 dark:to-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm shadow-xl hidden md:block fixed h-full border-r border-indigo-100 dark:border-indigo-950/50 z-10">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-indigo-100 dark:border-indigo-950/50">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-amber-500 text-transparent bg-clip-text">MindWave AI</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Supporto psicologico</p>
          </div>
          
          <div className="flex-1 py-4">
            <div className="px-4 mb-2">
              <h3 className="text-sm font-medium text-gray-500 uppercase">Menu</h3>
            </div>
            
            <Button
              variant={activeTab === 'chat' ? "secondary" : "ghost"}
              className={`w-full justify-start px-4 mb-1 ${activeTab === 'chat' ? 'bg-gradient-to-r from-indigo-100/80 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/20 text-indigo-700 dark:text-indigo-300 shadow-sm' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat Terapeutica
            </Button>
            
            <Button
              variant={activeTab === 'resources' ? "secondary" : "ghost"}
              className={`w-full justify-start px-4 mb-1 ${activeTab === 'resources' ? 'bg-gradient-to-r from-indigo-100/80 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/20 text-indigo-700 dark:text-indigo-300 shadow-sm' : ''}`}
              onClick={() => setActiveTab('resources')}
            >
              <Book className="mr-2 h-4 w-4" />
              Risorse
            </Button>
            
            <Button
              variant={activeTab === 'mood' ? "secondary" : "ghost"}
              className={`w-full justify-start px-4 mb-1 ${activeTab === 'mood' ? 'bg-gradient-to-r from-indigo-100/80 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/20 text-indigo-700 dark:text-indigo-300 shadow-sm' : ''}`}
              onClick={() => setActiveTab('mood')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Traccia Umore
            </Button>
            
            <Button
              variant={activeTab === 'profile' ? "secondary" : "ghost"}
              className={`w-full justify-start px-4 mb-1 ${activeTab === 'profile' ? 'bg-gradient-to-r from-indigo-100/80 to-indigo-200/50 dark:from-indigo-900/40 dark:to-indigo-800/20 text-indigo-700 dark:text-indigo-300 shadow-sm' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User className="mr-2 h-4 w-4" />
              Profilo
            </Button>
          </div>
          
          <div className="p-4 border-t border-indigo-100 dark:border-indigo-950/50">
            <div className="flex items-center mb-4">
              <Avatar className="h-9 w-9 mr-2 border-2 border-indigo-200 dark:border-indigo-800">
                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white">
                  {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.first_name || user.email}</p>
                <p className="text-xs text-gray-500">Paziente</p>
              </div>
            </div>
            <Button variant="outline" className="w-full border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 shadow-lg p-4 border-b border-indigo-100 dark:border-indigo-950/50">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-amber-500 text-transparent bg-clip-text">MindWave AI</h2>
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8 border-2 border-indigo-200 dark:border-indigo-800">
              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white">
                {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full bg-indigo-50 dark:bg-indigo-950/50">
            <TabsTrigger value="chat" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-400 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><MessageSquare className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="resources" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-400 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><Book className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="mood" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-400 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><BarChart3 className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-400 data-[state=active]:to-indigo-600 data-[state=active]:text-white"><User className="h-4 w-4" /></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Main content */}
      <div className="md:pl-64">
        <div className="md:p-8 p-4 md:pt-8 pt-28">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div>
              {/* Header con statistiche rapide */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-700 to-amber-600 text-transparent bg-clip-text flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-amber-500" />
                  Chat Terapeutica
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <Card className="overflow-hidden relative group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200/40 dark:hover:shadow-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Sessioni totali</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{sessions.length}</div>
                      <div className="mt-2 flex items-center text-muted-foreground text-sm">
                        <MessageSquare className="h-4 w-4 mr-1 text-indigo-500" />
                        Conversazioni salvate
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden relative group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200/40 dark:hover:shadow-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-700"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Ultima attività</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-medium">
                        {sessions.length > 0 
                          ? new Date(sessions[0].last_updated).toLocaleDateString() 
                          : 'Nessuna sessione'}
                      </div>
                      <div className="mt-2 flex items-center text-muted-foreground text-sm">
                        <Clock className="h-4 w-4 mr-1 text-indigo-500" />
                        Ultima conversazione
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden relative group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200/40 dark:hover:shadow-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Risorse</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{resources ? resources.length : 0}</div>
                      <div className="mt-2 flex items-center text-muted-foreground text-sm">
                        <Book className="h-4 w-4 mr-1 text-purple-500" />
                        Materiali consigliati
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden relative group transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200/40 dark:hover:shadow-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-amber-500"></div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Umore attuale</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{currentMood || "-"}/5</div>
                      <div className="mt-2 flex items-center text-muted-foreground text-sm">
                        <HeartPulse className="h-4 w-4 mr-1 text-amber-500" />
                        {currentMood 
                          ? currentMood === 5 ? 'Molto positivo'
                            : currentMood === 4 ? 'Positivo'
                            : currentMood === 3 ? 'Neutro'
                            : currentMood === 2 ? 'Negativo'
                            : 'Molto negativo'
                          : 'Non impostato'}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sessioni (visibili solo su schermi grandi) */}
                <Card className="lg:col-span-1 hidden lg:block backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center">
                        <MessageSquare className="h-5 w-5 mr-2 text-indigo-500" />
                        Le mie sessioni
                      </CardTitle>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/30" onClick={createNewSession}>
                        <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </Button>
                    </div>
                    <CardDescription>
                      Cronologia delle tue conversazioni
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingSessions ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 border-2 border-t-indigo-600 border-indigo-200 rounded-full animate-spin"></div>
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-8 space-y-3">
                        <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto">
                          <MessageSquare className="h-8 w-8 text-indigo-500" />
                        </div>
                        <p className="text-sm text-gray-500">Nessuna sessione trovata</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                          onClick={createNewSession}
                        >
                          Crea la tua prima sessione
                        </Button>
                      </div>
                    ) : (
                      <div className="h-[350px] overflow-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-indigo-800 scrollbar-track-transparent">
                        <div className="space-y-2">
                          {sessions.map(session => (
                            <div
                              key={session.id}
                              className={`p-3 rounded-lg cursor-pointer transition-all ${
                                activeSession === session.id 
                                  ? 'bg-gradient-to-r from-indigo-100 to-indigo-200/70 dark:from-indigo-900/40 dark:to-indigo-800/20 shadow-md' 
                                  : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:shadow-sm'
                              }`}
                              onClick={() => {
                                setActiveSession(session.id)
                                fetchMessages(session.id)
                              }}
                            >
                              <div className="font-medium text-sm">
                                {session.title || `Sessione ${new Date(session.created_at).toLocaleDateString()}`}
                              </div>
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <Clock className="h-3 w-3 mr-1" />
                                {new Date(session.last_updated).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Pulsante crea nuova sessione (su mobile) */}
                    <div className="lg:hidden mt-4">
                      <Button 
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white" 
                        onClick={createNewSession}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuova sessione
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Chat principale */}
                <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-300px)] md:h-[calc(100vh-340px)] backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-lg">
                  <CardHeader className="pb-3 border-b border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex justify-between items-center">
                      <CardTitle className="bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                        {activeSession ? (
                          <span>
                            {sessions.find(s => s.id === activeSession)?.title || 'Chat Terapeutica'}
                          </span>
                        ) : (
                          <span>Chat Terapeutica</span>
                        )}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setCurrentMood(null)}
                          className="lg:hidden border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                        >
                          <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="lg:hidden border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                          onClick={createNewSession}
                        >
                          <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Selezione umore */}
                    <div className="flex items-center space-x-2 pt-3">
                      <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium mr-1">Come ti senti oggi?</div>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map(value => (
                          <button
                            key={value}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              currentMood === value 
                                ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md' 
                                : 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300'
                            }`}
                            onClick={() => setCurrentMood(value)}
                            title={`Umore: ${value}`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={!currentMood}
                        onClick={saveCurrentMood}
                        className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                      >
                        Salva
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-indigo-800 scrollbar-track-transparent">
                    {!activeSession ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/20 flex items-center justify-center mb-4 shadow-inner">
                          <Sparkles className="h-12 w-12 text-indigo-500" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">Benvenuto nella Chat Terapeutica</h3>
                        <p className="text-gray-500 max-w-md mb-6">
                          Qui puoi parlare con il nostro assistente AI in modo sicuro e confidenziale.
                          Inizia creando una nuova sessione.
                        </p>
                        <Button 
                          onClick={createNewSession}
                          className="bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white shadow-md hover:shadow-lg transition-all"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Crea Nuova Sessione
                        </Button>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/20 flex items-center justify-center mb-4 shadow-inner">
                          <MessageSquare className="h-10 w-10 text-indigo-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">Inizia la conversazione</h3>
                        <p className="text-gray-500 max-w-md">
                          Scrivi un messaggio per iniziare a parlare con l'assistente AI.
                        </p>
                      </div>
                    ) : (
                      <div className="h-full pr-4 overflow-auto">
                        <div className="space-y-4">
                          {messages.map((message, index) => (
                            <div
                              key={index}
                              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] p-4 rounded-2xl ${
                                  message.role === 'user'
                                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                                    : message.isError 
                                      ? 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/20 text-red-700 dark:text-red-300 shadow-md'
                                      : 'bg-gradient-to-r from-gray-100 to-indigo-100/50 dark:from-gray-800 dark:to-indigo-900/30 text-gray-900 dark:text-gray-100 shadow-md'
                                }`}
                              >
                                {message.loading ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="animate-pulse flex space-x-1">
                                      <div className="h-2 w-2 bg-indigo-400 dark:bg-indigo-600 rounded-full"></div>
                                      <div className="h-2 w-2 bg-indigo-400 dark:bg-indigo-600 rounded-full animation-delay-200"></div>
                                      <div className="h-2 w-2 bg-indigo-400 dark:bg-indigo-600 rounded-full animation-delay-400"></div>
                                    </div>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">L'assistente sta scrivendo...</span>
                                  </div>
                                ) : (
                                  <div className="prose dark:prose-invert prose-sm max-w-none">
                                    {message.content}
                                  </div>
                                )}
                                
                                {message.role === 'assistant' && !message.loading && !message.isError && audioUrl && (
                                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs hover:bg-indigo-200/50 dark:hover:bg-indigo-800/30"
                                      onClick={playAudio}
                                      disabled={isPlaying}
                                    >
                                      {isPlaying ? (
                                        <Volume2 className="h-4 w-4 mr-1" />
                                      ) : (
                                        <Play className="h-4 w-4 mr-1" />
                                      )}
                                      {isPlaying ? 'Riproducendo...' : 'Ascolta risposta'}
                                    </Button>
                                  </div>
                                )}
                                
                                {message.role === 'assistant' && !message.loading && !message.isError && (
                                  <div className="flex items-center space-x-2 mt-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400"
                                    >
                                      <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400"
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="pt-3 border-t border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center w-full space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleRecording}
                        className={`border-indigo-200 dark:border-indigo-800 ${isRecording ? 'text-red-500 border-red-500 animate-pulse' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'}`}
                      >
                        <Mic className="h-5 w-5" />
                      </Button>
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Scrivi un messaggio..."
                        className="flex-1 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500 dark:focus:border-indigo-600 transition-colors"
                        disabled={!activeSession || isSending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!activeSession || !inputMessage.trim() || isSending}
                        className="bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white shadow-md hover:shadow-lg transition-all disabled:shadow-none"
                      >
                        {isSending ? 'Invio...' : 'Invia'}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            </div>
          )}
          
          {/* Risorse Tab */}
          {activeTab === 'resources' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-700 to-amber-600 text-transparent bg-clip-text flex items-center">
                  <Book className="h-5 w-5 mr-2 text-amber-500" />
                  Risorse Consigliate
                </h2>
                <p className="text-muted-foreground">Materiali personalizzati per il tuo percorso terapeutico</p>
              </div>
              
              {resources.length === 0 ? (
                <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-20 w-20 bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <Book className="h-10 w-10 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">Nessuna risorsa disponibile</h3>
                    <p className="text-gray-500 text-center max-w-md">
                      Continua a parlare con l'assistente AI per ricevere risorse consigliate personalizzate.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-6 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                      onClick={() => setActiveTab('chat')}
                    >
                      Vai alla chat
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {resources.map((resource, index) => (
                    <Card 
                      key={index} 
                      className="overflow-hidden backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md hover:shadow-lg hover:shadow-indigo-200/40 dark:hover:shadow-indigo-900/30 transition-all group"
                    >
                      <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg font-semibold bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text group-hover:from-indigo-600 group-hover:to-purple-600 transition-all">
                            {resource.title}
                          </CardTitle>
                          <Badge 
                            variant="outline" 
                            className="border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30"
                          >
                            {resource.type}
                          </Badge>
                        </div>
                        <CardDescription className="mt-2">{resource.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">{resource.description}</p>
                      </CardContent>
                      <CardFooter className="border-t border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/70 dark:to-indigo-900/50">
                        <Button 
                          variant="ghost" 
                          className="w-full text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                        >
                          Scopri di più
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Mood Tab */}
          {activeTab === 'mood' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-700 to-amber-600 text-transparent bg-clip-text flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-amber-500" />
                  Tracciamento dell'Umore
                </h2>
                <p className="text-muted-foreground">Monitora il tuo stato emotivo nel tempo</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                      <BarChart3 className="h-5 w-5 mr-2 text-indigo-500" />
                      Storico Umore
                    </CardTitle>
                    <CardDescription>
                      Le ultime 10 registrazioni del tuo umore
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {moodData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="h-16 w-16 bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/20 rounded-full flex items-center justify-center shadow-inner">
                          <BarChart3 className="h-8 w-8 text-indigo-500" />
                        </div>
                        <p className="text-gray-500 text-center">
                          Non hai ancora registrato il tuo umore. Inizia a tracciare come ti senti!
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                          onClick={() => document.getElementById('mood-input')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          Registra umore
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg mb-3">
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Data</span>
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Valore (1-5)</span>
                        </div>
                        <div className="h-[300px] overflow-auto scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-indigo-800 scrollbar-track-transparent">
                          <div className="space-y-2">
                            {moodData.map((item, index) => (
                              <div 
                                key={index} 
                                className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/30 pb-2 px-4 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              >
                                <span className="text-sm">{item.date}</span>
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map(v => (
                                    <div
                                      key={v}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center mr-1 ${
                                        v <= item.value 
                                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm' 
                                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-300 dark:text-indigo-700'
                                      }`}
                                    >
                                      {v}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card id="mood-input" className="backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-500 to-purple-500"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                      <HeartPulse className="h-5 w-5 mr-2 text-indigo-500" />
                      Registra il tuo umore
                    </CardTitle>
                    <CardDescription>
                      Come ti senti oggi?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center py-6">
                      <div className="flex space-x-4 mb-8">
                        {[1, 2, 3, 4, 5].map(value => (
                          <button
                            key={value}
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                              currentMood === value 
                                ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md scale-110' 
                                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:scale-105'
                            }`}
                            onClick={() => setCurrentMood(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="text-center mb-6">
                        <p className="text-lg font-medium mb-2 bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                          {currentMood ? `Hai selezionato: ${currentMood}/5` : 'Seleziona un valore'}
                        </p>
                        <div className={`px-4 py-2 rounded-full ${
                          currentMood === 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 
                          currentMood === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                          currentMood === 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          currentMood === 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          currentMood === 5 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 
                          'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
                        }`}>
                          {currentMood === 1 ? 'Molto negativo' : 
                          currentMood === 2 ? 'Negativo' :
                          currentMood === 3 ? 'Neutro' :
                          currentMood === 4 ? 'Positivo' :
                          currentMood === 5 ? 'Molto positivo' : 'Seleziona come ti senti oggi'}
                        </div>
                      </div>
                      <Button 
                        disabled={!currentMood} 
                        onClick={saveCurrentMood}
                        className="px-8 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white shadow-md hover:shadow-lg transition-all disabled:shadow-none"
                      >
                        Salva
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-700 to-amber-600 text-transparent bg-clip-text flex items-center">
                  <User className="h-5 w-5 mr-2 text-amber-500" />
                  Il tuo Profilo
                </h2>
                <p className="text-muted-foreground">Gestisci le tue informazioni personali e preferenze</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <CardHeader className="text-center">
                    <div className="relative inline-block mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 blur-md opacity-20 animate-pulse"></div>
                      <Avatar className="h-24 w-24 border-2 border-indigo-200 dark:border-indigo-800">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-2xl font-semibold">
                          {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <CardTitle className="text-xl bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                      {user.first_name || ''} {user.last_name || ''}
                    </CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                        <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center mb-1">
                          <Badge className="h-4 w-4 mr-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-none" variant="outline">
                            <User className="h-3 w-3" />
                          </Badge>
                          Ruolo
                        </div>
                        <div className="font-medium">Paziente</div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                        <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center mb-1">
                          <Badge className="h-4 w-4 mr-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-none" variant="outline">
                            <CalendarDays className="h-3 w-3" />
                          </Badge>
                          Iscritto dal
                        </div>
                        <div className="font-medium">
                          {user.created_at 
                            ? new Date(user.created_at).toLocaleDateString() 
                            : 'Non disponibile'}
                        </div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                        <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center mb-1">
                          <Badge className="h-4 w-4 mr-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-none" variant="outline">
                            <MessageSquare className="h-3 w-3" />
                          </Badge>
                          Sessioni totali
                        </div>
                        <div className="font-medium">{sessions.length}</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      <FileEdit className="mr-2 h-4 w-4" />
                      Modifica profilo
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card className="lg:col-span-2 backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-500 to-purple-500"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                      <Settings className="h-5 w-5 mr-2 text-indigo-500" />
                      Impostazioni e Preferenze
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3 flex items-center text-indigo-700 dark:text-indigo-300">
                        <Bell className="h-4 w-4 mr-2" />
                        Notifiche
                      </h3>
                      <Separator className="my-2 bg-indigo-100 dark:bg-indigo-900/50" />
                      <div className="space-y-3 mt-3">
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                          <label className="text-sm font-medium" htmlFor="email-notif">Notifiche via email</label>
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              id="email-notif" 
                              className="sr-only" 
                              defaultChecked 
                            />
                            <div className="block bg-indigo-200 dark:bg-indigo-800 w-10 h-6 rounded-full"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform checked:translate-x-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                          <label className="text-sm font-medium" htmlFor="remind-notif">Promemoria sessioni</label>
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              id="remind-notif" 
                              className="sr-only" 
                            />
                            <div className="block bg-indigo-200 dark:bg-indigo-800 w-10 h-6 rounded-full"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-3 flex items-center text-indigo-700 dark:text-indigo-300">
                        <Shield className="h-4 w-4 mr-2" />
                        Privacy
                      </h3>
                      <Separator className="my-2 bg-indigo-100 dark:bg-indigo-900/50" />
                      <div className="space-y-3 mt-3">
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                          <label className="text-sm font-medium" htmlFor="data-collect">Raccolta dati per migliorare il servizio</label>
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              id="data-collect" 
                              className="sr-only" 
                              defaultChecked 
                            />
                            <div className="block bg-indigo-200 dark:bg-indigo-800 w-10 h-6 rounded-full"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform checked:translate-x-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                          <label className="text-sm font-medium" htmlFor="share-therapist">Condividi dati con il terapeuta</label>
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              id="share-therapist" 
                              className="sr-only" 
                              defaultChecked 
                            />
                            <div className="block bg-indigo-200 dark:bg-indigo-800 w-10 h-6 rounded-full"></div>
                            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform checked:translate-x-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-3 flex items-center text-indigo-700 dark:text-indigo-300">
                        <Languages className="h-4 w-4 mr-2" />
                        Lingue e Accessibilità
                      </h3>
                      <Separator className="my-2 bg-indigo-100 dark:bg-indigo-900/50" />
                      <div className="space-y-3 mt-3">
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                          <label className="text-sm font-medium">Lingua dell'interfaccia</label>
                          <select className="text-sm p-2 border rounded-md border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none">
                            <option>Italiano</option>
                            <option>English</option>
                            <option>Español</option>
                            <option>Français</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                          <label className="text-sm font-medium">Dimensione testo</label>
                          <select className="text-sm p-2 border rounded-md border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none">
                            <option>Normale</option>
                            <option>Grande</option>
                            <option>Molto grande</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-r from-indigo-50 to-indigo-100/50 dark:from-indigo-950/70 dark:to-indigo-900/50">
                    <Button className="ml-auto bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white shadow-md hover:shadow-lg transition-all">
                      Salva impostazioni
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card className="lg:col-span-3 backdrop-blur-sm bg-white/90 dark:bg-gray-900/80 border border-indigo-100 dark:border-indigo-900/50 shadow-md overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg bg-gradient-to-r from-indigo-700 to-indigo-500 text-transparent bg-clip-text">
                      <HelpCircle className="h-5 w-5 mr-2 text-indigo-500" />
                      Supporto e Assistenza
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                      <h3 className="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Domande Frequenti</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        Trova risposte alle domande più comuni relative al servizio.
                      </p>
                      <Button variant="outline" className="w-full border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                        Consulta FAQ
                      </Button>
                    </div>
                    
                    <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                      <h3 className="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Contatta il Supporto</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        Hai bisogno di aiuto? Il nostro team di supporto è qui per te.
                      </p>
                      <Button variant="outline" className="w-full border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                        Apri ticket
                      </Button>
                    </div>
                    
                    <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                      <h3 className="font-medium text-indigo-700 dark:text-indigo-300 mb-2">Tutorial e Guide</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        Scopri come utilizzare al meglio la piattaforma.
                      </p>
                      <Button variant="outline" className="w-full border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                        Visualizza guide
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}