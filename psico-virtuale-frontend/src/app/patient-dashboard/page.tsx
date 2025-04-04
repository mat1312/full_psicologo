'use client'

import { useState, useEffect } from 'react'
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
  ThumbsDown
} from 'lucide-react'
import { apiClient, ChatMessage, ResourceItem } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'

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
  const fetchMessages = async (sessionId: string) => {
    if (!sessionId) return
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      
      const formattedMessages: ChatMessage[] = data.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
      
      setMessages(formattedMessages)
      
      // Recupera le risorse consigliate per questa sessione
      fetchResources(sessionId)
    } catch (error) {
      console.error('Errore nel recupero dei messaggi:', error)
      toast.error('Errore nel caricamento dei messaggi')
    }
  }

  // Funzione per recuperare le risorse consigliate
  const fetchResources = async (sessionId: string) => {
    if (!sessionId) return;
    
    try {
      const response = await apiClient.getResourceRecommendations('', sessionId);
      setResources(response.resources);
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
    
    // Aggiunge immediatamente il messaggio dell'utente alla UI
    const userMessage: ChatMessage = { role: 'user', content: inputMessage }
    setMessages(prev => [...prev, userMessage])
    
    // Salva il messaggio dell'utente nel database
    try {
      await supabase
        .from('messages')
        .insert({
          session_id: activeSession,
          role: 'user',
          content: inputMessage
        })
    } catch (error) {
      console.error('Errore nel salvataggio del messaggio:', error)
    }
    
    setInputMessage('')
    setIsSending(true)
    
    try {
      // Invia il messaggio all'API
      const moodString = currentMood ? currentMood.toString() : undefined
      const response = await apiClient.sendMessage(inputMessage, activeSession, moodString)
      
      // Aggiunge la risposta dell'AI alla UI
      const aiMessage: ChatMessage = { role: 'assistant', content: response.answer }
      setMessages(prev => [...prev, aiMessage])
      
      // Salva la risposta dell'AI nel database
      try {
        await supabase
          .from('messages')
          .insert({
            session_id: activeSession,
            role: 'assistant',
            content: response.answer
          })
      } catch (error) {
        console.error('Errore nel salvataggio della risposta:', error)
      }
      
      // Se c'è un audio URL, lo salva per la riproduzione
      if (response.audio_url) {
        setAudioUrl(response.audio_url)
      }
      
      // Aggiorna le risorse consigliate
      fetchResources(activeSession)
    } catch (error) {
      console.error('Errore nell\'invio del messaggio:', error)
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

  // Mostra il loader mentre verifichiamo l'autenticazione
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Caricamento...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-950 shadow-md hidden md:block">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">MindWave AI</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Supporto psicologico</p>
          </div>
          
          <div className="flex-1 py-4">
            <div className="px-4 mb-2">
              <h3 className="text-sm font-medium text-gray-500 uppercase">Menu</h3>
            </div>
            
            <Button
              variant={activeTab === 'chat' ? "secondary" : "ghost"}
              className="w-full justify-start px-4 mb-1"
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat Terapeutica
            </Button>
            
            <Button
              variant={activeTab === 'resources' ? "secondary" : "ghost"}
              className="w-full justify-start px-4 mb-1"
              onClick={() => setActiveTab('resources')}
            >
              <Book className="mr-2 h-4 w-4" />
              Risorse
            </Button>
            
            <Button
              variant={activeTab === 'mood' ? "secondary" : "ghost"}
              className="w-full justify-start px-4 mb-1"
              onClick={() => setActiveTab('mood')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Traccia Umore
            </Button>
            
            <Button
              variant={activeTab === 'profile' ? "secondary" : "ghost"}
              className="w-full justify-start px-4 mb-1"
              onClick={() => setActiveTab('profile')}
            >
              <User className="mr-2 h-4 w-4" />
              Profilo
            </Button>
          </div>
          
          <div className="p-4 border-t">
            <div className="flex items-center mb-4">
              <Avatar className="h-9 w-9 mr-2">
                <AvatarFallback className="bg-indigo-100 text-indigo-600">
                  {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.first_name || user.email}</p>
                <p className="text-xs text-gray-500">Paziente</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-gray-950 z-10 shadow-sm p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">MindWave AI</h2>
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-600">
                {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="chat"><MessageSquare className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="resources"><Book className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="mood"><BarChart3 className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="profile"><User className="h-4 w-4" /></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Main content */}
      <div className="flex-1 md:p-6 p-4 md:pt-6 pt-28">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sessioni (visibili solo su schermi grandi) */}
            <Card className="lg:col-span-1 hidden lg:block">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle>Le mie sessioni</CardTitle>
                  <Button size="sm" variant="ghost" onClick={createNewSession}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSessions ? (
                  <p className="text-center py-4 text-sm text-gray-500">Caricamento...</p>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-6">
                    <MessageSquare className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Nessuna sessione trovata</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={createNewSession}
                    >
                      Crea la tua prima sessione
                    </Button>
                  </div>
                ) : (
                  <div className="h-[300px] overflow-auto pr-2">
                    <div className="space-y-2">
                      {sessions.map(session => (
                        <div
                          key={session.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            activeSession === session.id 
                              ? 'bg-indigo-100 dark:bg-indigo-900/30' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800/30'
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
                  <Button className="w-full" onClick={createNewSession}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuova sessione
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Chat principale */}
            <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-160px)]">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle>
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
                      className="lg:hidden"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="lg:hidden"
                      onClick={createNewSession}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Selezione umore */}
                <div className="flex items-center space-x-2 pt-2">
                  <div className="text-sm text-gray-500 mr-1">Come ti senti oggi?</div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map(value => (
                      <button
                        key={value}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          currentMood === value 
                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
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
                  >
                    Salva
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-auto">
                {!activeSession ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="h-24 w-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                      <Sparkles className="h-12 w-12 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Benvenuto nella Chat Terapeutica</h3>
                    <p className="text-gray-500 max-w-md mb-6">
                      Qui puoi parlare con il nostro assistente AI in modo sicuro e confidenziale.
                      Inizia creando una nuova sessione.
                    </p>
                    <Button onClick={createNewSession}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea Nuova Sessione
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <div className="h-20 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                      <MessageSquare className="h-10 w-10 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Inizia la conversazione</h3>
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
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            <div className="prose dark:prose-invert prose-sm max-w-none">
                              {message.content}
                            </div>
                            
                            {message.role === 'assistant' && index === messages.length - 1 && audioUrl && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs"
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
                            
                            {message.role === 'assistant' && (
                              <div className="flex items-center space-x-2 mt-2">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <ThumbsUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
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
              
              <CardFooter className="pt-3">
                <div className="flex items-center w-full space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleRecording}
                    className={isRecording ? 'text-red-500 border-red-500 animate-pulse' : ''}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Scrivi un messaggio..."
                    className="flex-1"
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
                  >
                    {isSending ? 'Invio...' : 'Invia'}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        )}
        
        {/* Risorse Tab */}
        {activeTab === 'resources' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Risorse Consigliate</h2>
            </div>
            
            {resources.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Book className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nessuna risorsa disponibile</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Continua a parlare con l'assistente AI per ricevere risorse consigliate personalizzate.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('chat')}
                  >
                    Vai alla chat
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources.map((resource, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{resource.title}</CardTitle>
                        <Badge variant="outline">{resource.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 dark:text-gray-300">{resource.description}</p>
                    </CardContent>
                    <CardFooter className="border-t bg-gray-50 dark:bg-gray-900">
                      <Button variant="ghost" className="w-full">Scopri di più</Button>
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Tracciamento dell'Umore</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Storico Umore</CardTitle>
                  <CardDescription>
                    Gli ultimi 10 registrazioni del tuo umore
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {moodData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-center">
                        Non hai ancora registrato il tuo umore. Inizia a tracciare come ti senti!
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between px-2 py-2">
                        <span className="text-sm font-medium text-gray-500">Data</span>
                        <span className="text-sm font-medium text-gray-500">Valore (1-5)</span>
                      </div>
                      <div className="h-[300px] overflow-auto">
                        <div className="space-y-2">
                          {moodData.map((item, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between border-b pb-2 px-2"
                            >
                              <span className="text-sm">{item.date}</span>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map(v => (
                                  <div
                                    key={v}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center mr-1 ${
                                      v <= item.value 
                                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300' 
                                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Registra il tuo umore</CardTitle>
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
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-colors ${
                            currentMood === value 
                              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300' 
                              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => setCurrentMood(value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="text-center mb-6">
                      <p className="text-lg font-medium mb-1">
                        {currentMood ? `Hai selezionato: ${currentMood}/5` : 'Seleziona un valore'}
                      </p>
                      <p className="text-gray-500">
                        {currentMood === 1 ? 'Molto negativo' : 
                         currentMood === 2 ? 'Negativo' :
                         currentMood === 3 ? 'Neutro' :
                         currentMood === 4 ? 'Positivo' :
                         currentMood === 5 ? 'Molto positivo' : 'Seleziona come ti senti oggi'}
                      </p>
                    </div>
                    <Button 
                      disabled={!currentMood} 
                      onClick={saveCurrentMood}
                      className="px-8"
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Il tuo Profilo</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader className="text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-2">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 text-2xl">
                      {user.first_name ? user.first_name[0] : user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle>{user.first_name || ''} {user.last_name || ''}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-500">Ruolo</div>
                      <div>Paziente</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Iscritto dal</div>
                      <div>
                        {user.created_at 
                          ? new Date(user.created_at).toLocaleDateString() 
                          : 'Non disponibile'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">Sessioni totali</div>
                      <div>{sessions.length}</div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">Modifica profilo</Button>
                </CardFooter>
              </Card>
              
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Impostazioni e Preferenze</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Notifiche</h3>
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm" htmlFor="email-notif">Notifiche via email</label>
                        <input 
                          type="checkbox" 
                          id="email-notif" 
                          className="h-4 w-4 rounded border-gray-300" 
                          defaultChecked 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm" htmlFor="remind-notif">Promemoria sessioni</label>
                        <input 
                          type="checkbox" 
                          id="remind-notif" 
                          className="h-4 w-4 rounded border-gray-300" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Privacy</h3>
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm" htmlFor="data-collect">Raccolta dati per migliorare il servizio</label>
                        <input 
                          type="checkbox" 
                          id="data-collect" 
                          className="h-4 w-4 rounded border-gray-300" 
                          defaultChecked 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm" htmlFor="share-therapist">Condividi dati con il terapeuta</label>
                        <input 
                          type="checkbox" 
                          id="share-therapist" 
                          className="h-4 w-4 rounded border-gray-300" 
                          defaultChecked 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Lingue e Accessibilità</h3>
                    <hr className="my-2 border-gray-200 dark:border-gray-700" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Lingua dell'interfaccia</label>
                        <select className="text-sm p-1 border rounded">
                          <option>Italiano</option>
                          <option>English</option>
                          <option>Español</option>
                          <option>Français</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Dimensione testo</label>
                        <select className="text-sm p-1 border rounded">
                          <option>Normale</option>
                          <option>Grande</option>
                          <option>Molto grande</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="ml-auto">Salva impostazioni</Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}