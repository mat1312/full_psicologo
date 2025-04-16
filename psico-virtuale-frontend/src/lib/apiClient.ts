import axios from 'axios';

// Define the types used in the patient dashboard
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  description: string;
  url?: string;
  type: 'document' | 'video' | 'exercise' | 'link';
  createdAt: string;
}

export interface ResourceRecommendation extends ResourceItem {
  relevance: number;
  matchReason?: string;
}

// Interfaces for therapist dashboard
export interface SessionSummaryResponse {
  summary_html: string;
}

export interface MoodAnalysisResponse {
  mood_analysis: string;
}

export interface PathologyItem {
  name: string;
  description: string;
  confidence: number;
  key_symptoms: string[];
  source?: string;
}

export interface PathologyAnalysisResponse {
  possible_pathologies: PathologyItem[];
  analysis_summary: string;
}

// Mock data for development
const MOCK_DATA = {
  messages: [
    {
      id: '1',
      role: 'assistant',
      content: 'Ciao! Come posso aiutarti oggi?',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: '2',
      role: 'user',
      content: 'Mi sento molto ansioso ultimamente',
      timestamp: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: '3',
      role: 'assistant',
      content: 'Mi dispiace sentire che stai attraversando un periodo di ansia. Potresti dirmi di più su cosa ti sta causando questa ansia?',
      timestamp: new Date(Date.now() - 3400000).toISOString()
    }
  ] as ChatMessage[],
  
  resources: [
    {
      id: '1',
      title: 'Tecniche di respirazione per l\'ansia',
      description: 'Una guida pratica alle tecniche di respirazione che possono aiutare a gestire l\'ansia',
      type: 'exercise',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '2',
      title: 'Mindfulness quotidiana',
      description: 'Come incorporare la pratica della mindfulness nella tua routine quotidiana',
      type: 'document',
      createdAt: new Date(Date.now() - 172800000).toISOString()
    }
  ] as ResourceItem[],
  
  recommendations: [
    {
      id: '1',
      title: 'Gestire l\'ansia: strategie pratiche',
      description: 'Un documento con strategie concrete per gestire i sintomi dell\'ansia',
      type: 'document',
      relevance: 0.95,
      matchReason: 'Basato sui recenti argomenti discussi',
      createdAt: new Date(Date.now() - 259200000).toISOString()
    },
    {
      id: '2',
      title: 'Esercizio di rilassamento muscolare progressivo',
      description: 'Una tecnica guidata per rilassare progressivamente i muscoli del corpo',
      type: 'exercise',
      relevance: 0.85,
      matchReason: 'Utile per i sintomi fisici dell\'ansia',
      createdAt: new Date(Date.now() - 345600000).toISOString()
    }
  ] as ResourceRecommendation[],
  
  sessionSummary: {
    summary_html: `
      <div class="p-4 bg-gray-50 rounded-lg">
        <h2 class="text-xl font-semibold mb-4 text-blue-700">Riepilogo della Sessione</h2>
        <div class="mb-4 pb-3 border-b border-gray-200">
          <div class="mb-1"><span class="text-gray-700 font-medium">Paziente:</span></div>
          <p class="pl-2">Mi sento molto ansioso ultimamente. Ho problemi a dormire e mi preoccupo costantemente.</p>
        </div>
        <div class="mb-4 pb-3 border-b border-gray-200">
          <div class="mb-1"><span class="text-blue-600 font-medium">Psicologo:</span></div>
          <p class="pl-2">Capisco che stai attraversando un periodo difficile. L'ansia e i problemi di sonno spesso vanno di pari passo. Da quanto tempo noti questi sintomi?</p>
        </div>
        <div class="mb-4 pb-3 border-b border-gray-200">
          <div class="mb-1"><span class="text-gray-700 font-medium">Paziente:</span></div>
          <p class="pl-2">È iniziato circa un mese fa, dopo un periodo molto stressante al lavoro.</p>
        </div>
      </div>
    `
  },
  
  moodAnalysis: {
    mood_analysis: `
      # Analisi della Conversazione Terapeutica
      
      ## 1. Valutazione dell'umore generale del paziente
      Il paziente mostra segni di ansia moderata, associata a difficoltà del sonno e preoccupazioni costanti. Il tono emotivo generale è di stress e apprensione, con una chiara consapevolezza del problema.
      
      ## 2. Eventuali schemi di pensiero o comportamento ricorrenti
      Si nota una tendenza alla preoccupazione anticipatoria e possibilmente un collegamento tra stress lavorativo e sintomi d'ansia. Il paziente sembra fare connessioni tra eventi esterni e il proprio stato emotivo.
      
      ## 3. Suggerimenti per il terapeuta su come procedere nella prossima sessione
      - Esplorare ulteriormente la relazione tra stress lavorativo e sintomi d'ansia
      - Valutare la qualità e quantità del sonno con maggiori dettagli
      - Introdurre possibili tecniche di rilassamento come la respirazione profonda o la mindfulness
    `
  },
  
  pathologyAnalysis: {
    possible_pathologies: [
      {
        name: "Disturbo d'Ansia Generalizzato",
        description: "Ansia e preoccupazione eccessive e persistenti riguardo vari aspetti della vita quotidiana",
        confidence: 0.75,
        key_symptoms: ["Preoccupazione costante", "Problemi di sonno", "Ansia legata a situazioni di stress"],
        source: "DSM-5: 300.02"
      },
      {
        name: "Disturbo dell'Adattamento con Ansia",
        description: "Reazione ansiosa a un fattore di stress identificabile che causa disagio significativo",
        confidence: 0.63,
        key_symptoms: ["Ansia in risposta a fattori di stress", "Insorgenza temporalmente correlata a eventi stressanti", "Difficoltà di sonno"],
        source: "DSM-5: 309.24"
      }
    ],
    analysis_summary: "L'analisi suggerisce la presenza di sintomi compatibili con forme di ansia che potrebbero essere collegate a fattori stressanti identificati (lavoro). I sintomi descritti sono coerenti con un disturbo d'ansia di intensità moderata, ma una diagnosi definitiva richiederebbe un'esplorazione più approfondita e un'anamnesi completa. Consigliabile valutare l'impatto funzionale dell'ansia e monitorare l'evoluzione dei sintomi."
  }
};

// Flag to determine if we should use mock data (disable by default)
const USE_MOCK_DATA = false; // Set to true manually if needed for testing

// DEMO MODE: Abilitare per presentazioni senza backend
const DEMO_MODE = true;

// Create axios instance with default config
const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
instance.interceptors.request.use((config) => {
  // Get token from localStorage or session
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
  
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Add a request cache to prevent duplicate requests
const recommendationsCache: Record<string, Promise<ResourceRecommendation[]>> = {};

// API client methods
export const apiClient = {
  // Chat methods
  getMessages: async (patientId: string): Promise<ChatMessage[]> => {
    // Return mock data if enabled or backend is unreachable
    if (USE_MOCK_DATA) {
      return Promise.resolve(MOCK_DATA.messages);
    }
    
    try {
      const response = await instance.get<ChatMessage[]>(`/patients/${patientId}/messages`);
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Fallback to mock data on error
      return MOCK_DATA.messages;
    }
  },
  
  sendMessage: async (message: string, sessionId: string, mood?: string, isPatientChat: boolean = false): Promise<any> => {
    // Return mock data only if explicitly enabled, not automatically in development mode
    if (USE_MOCK_DATA) {
      console.log('Using mock data for sendMessage (explicitly enabled)');
      // Simulate a delay for a more realistic experience
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        answer: "Questa è una risposta di esempio dal sistema di mock. Il backend non è connesso.",
        session_id: sessionId
      };
    }
    
    try {
      // Determine the correct endpoint based on isPatientChat
      const endpoint = isPatientChat ? '/api/patient-chat' : '/api/chat';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify({ 
          query: message,
          session_id: sessionId,
          mood: mood
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Only fall back to mock data if there's an error and we're in development
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('Providing mock response after error in development mode');
        return {
          answer: "Si è verificato un errore nel contattare il backend. Risposta di fallback.",
          session_id: sessionId
        };
      }
      
      throw error;
    }
  },
  
  // Resource methods
  getResources: async (patientId: string): Promise<ResourceItem[]> => {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return Promise.resolve(MOCK_DATA.resources);
    }
    
    try {
      const response = await instance.get<ResourceItem[]>(`/patients/${patientId}/resources`);
      return response.data;
    } catch (error) {
      console.error('Error fetching resources:', error);
      // Fallback to mock data on error
      return MOCK_DATA.resources;
    }
  },
  
  addResource: async (patientId: string, resource: Omit<ResourceItem, 'id' | 'createdAt'>): Promise<ResourceItem> => {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      const newResource: ResourceItem = {
        ...resource,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString()
      };
      return Promise.resolve(newResource);
    }
    
    try {
      const response = await instance.post<ResourceItem>(`/patients/${patientId}/resources`, resource);
      return response.data;
    } catch (error) {
      console.error('Error adding resource:', error);
      // Create a mock response
      return {
        ...resource,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString()
      };
    }
  },
  
  // Resource recommendation methods
  getResourceRecommendations: async (patientId: string, sessionId?: string): Promise<ResourceRecommendation[]> => {
    // In DEMO MODE, ritorna sempre i dati mock
    if (DEMO_MODE) {
      console.log('DEMO MODE: Using mock recommendations data');
      // Simula un breve ritardo per rendere più realistico
      await new Promise(resolve => setTimeout(resolve, 300));
      return MOCK_DATA.recommendations;
    }
    
    // Create a cache key
    const cacheKey = `${patientId}:${sessionId || 'none'}`;
    
    // Check if there's already an ongoing request for this combination
    if (cacheKey in recommendationsCache) {
      console.log('Using cached recommendations request');
      return recommendationsCache[cacheKey];
    }
    
    // Start a new request and store it in the cache
    const requestPromise = (async () => {
      try {
        // Attempt to get recommendations from the backend
        const url = `/patients/${patientId}/recommendations`;
        const params = sessionId ? { query: sessionId } : undefined;
        
        try {
          const response = await instance.get<ResourceRecommendation[]>(url, { params });
          return response.data;
        } catch (error: any) {
          console.log('Error with patient recommendations endpoint:', error.message);
          
          // If the endpoint returns 404 or 403, try the alternative API endpoints
          if (error.response && (error.response.status === 404 || error.response.status === 403)) {
            console.log('Patient recommendations endpoint returned', error.response.status, 'trying alternative API...');
            
            // First try the regular API endpoint
            try {
              const alternativeUrl = `/api/recommend-resources`;
              const data = { query: sessionId || '', session_id: sessionId || '' };
              const altResponse = await instance.post<{ resources: ResourceRecommendation[] }>(
                alternativeUrl, 
                data
              );
              return altResponse.data.resources;
            } catch (altError: any) {
              console.log('Alternative API failed with:', altError.message);
              
              // If that also fails, try the public endpoint as last resort
              try {
                const publicUrl = `/api/public/recommendations`;
                const publicParams = { session_id: sessionId };
                const publicResponse = await instance.get<{ resources: ResourceRecommendation[] }>(publicUrl, { params: publicParams });
                return publicResponse.data.resources;
              } catch (publicError: any) {
                console.log('Public API also failed:', publicError.message);
                throw publicError;
              }
            }
          }
          throw error;
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        
        // Use mock data as fallback for development or when API isn't available
        console.log('Using mock recommendations data as fallback');
        return MOCK_DATA.recommendations;
      } finally {
        // Clear from cache after response (with a small delay to prevent immediate duplicate calls)
        setTimeout(() => {
          delete recommendationsCache[cacheKey];
        }, 2000);
      }
    })();
    
    // Store the promise in the cache and return it
    recommendationsCache[cacheKey] = requestPromise;
    return requestPromise;
  },
  
  // Therapist dashboard methods
  
  // Get session summary for therapist dashboard
  getSessionSummary: async (sessionId: string): Promise<SessionSummaryResponse> => {
    // Return mock data if enabled or in demo mode
    if (USE_MOCK_DATA || DEMO_MODE) {
      console.log('Using mock session summary data');
      await new Promise(resolve => setTimeout(resolve, 300));
      return MOCK_DATA.sessionSummary;
    }
    
    try {
      // Try to use the server route first (which can handle authentication)
      try {
        const response = await fetch(`/api/session-summary/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        return await response.json();
      } catch (serverError) {
        console.error('Server route error:', serverError);
        
        // If server route fails, try direct backend call
        const response = await instance.get<SessionSummaryResponse>(`/api/session-summary/${sessionId}`);
        return response.data;
      }
    } catch (error) {
      console.error('Error fetching session summary:', error);
      // Return mock data as fallback
      return MOCK_DATA.sessionSummary;
    }
  },
  
  // Get mood analysis for therapist dashboard
  getMoodAnalysis: async (sessionId: string): Promise<MoodAnalysisResponse> => {
    // Return mock data if enabled or in demo mode
    if (USE_MOCK_DATA || DEMO_MODE) {
      console.log('Using mock mood analysis data');
      await new Promise(resolve => setTimeout(resolve, 500));
      return MOCK_DATA.moodAnalysis;
    }
    
    try {
      // Try to use the server route first
      try {
        const response = await fetch(`/api/mood-analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            analyze_chatbot: true
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        return await response.json();
      } catch (serverError) {
        console.error('Server route error for mood analysis:', serverError);
        
        // If server route fails, try direct backend call
        const response = await instance.get<MoodAnalysisResponse>(`/api/mood-analysis/${sessionId}`);
        return response.data;
      }
    } catch (error) {
      console.error('Error fetching mood analysis:', error);
      // Return mock data as fallback
      return MOCK_DATA.moodAnalysis;
    }
  },
  
  // Get pathology analysis for therapist dashboard
  getPathologyAnalysis: async (sessionId: string): Promise<PathologyAnalysisResponse> => {
    // Return mock data if enabled or in demo mode
    if (USE_MOCK_DATA || DEMO_MODE) {
      console.log('Using mock pathology analysis data');
      await new Promise(resolve => setTimeout(resolve, 700));
      return MOCK_DATA.pathologyAnalysis;
    }
    
    try {
      // Try to use the server route first
      try {
        const response = await fetch(`/api/pathology-analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
          },
          body: JSON.stringify({
            session_id: sessionId,
            analyze_chatbot: true
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        return await response.json();
      } catch (serverError) {
        console.error('Server route error for pathology analysis:', serverError);
        
        // If server route fails, try direct backend call
        const response = await instance.post<PathologyAnalysisResponse>(`/api/pathology-analysis`, {
          session_id: sessionId,
          analyze_chatbot: true
        });
        return response.data;
      }
    } catch (error) {
      console.error('Error fetching pathology analysis:', error);
      // Return mock data as fallback
      return MOCK_DATA.pathologyAnalysis;
    }
  }
}; 