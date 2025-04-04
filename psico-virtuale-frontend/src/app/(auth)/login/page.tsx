'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('patient') // Default ruolo: paziente
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const router = useRouter()
  const { initialize, user } = useAuthStore()

  useEffect(() => {
    // Controlla se l'utente è già autenticato
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // Inizializza lo store per assicurarsi che user sia impostato
          await initialize()
          
          // Verifica il ruolo dell'utente e reindirizza di conseguenza
          const currentUser = useAuthStore.getState().user
          if (currentUser?.role === 'therapist') {
            // window.location.href = '/therapist-dashboard'
            router.push('/therapist-dashboard')
          } else {
            // window.location.href = '/patient-dashboard'
            router.push('/patient-dashboard')
          }
        }
      } catch (error) {
        console.error("Errore durante il controllo della sessione:", error)
      }
    }
    
    checkSession()
  }, [initialize, router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error("Errore", { description: "Email e password sono richiesti" })
      return
    }
    
    setLoading(true)
    
    // Timeout per evitare attese infinite
    const authTimeout = setTimeout(() => {
      console.log("Login timeout - operazione bloccata")
      setLoading(false)
      toast.error("Errore", { description: "Operazione interrotta per timeout. Riprova." })
    }, 10000) // 10 secondi di timeout

    try {
      if (isLogin) {
        console.log("Tentativo di login con:", email)
        
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        // Cancella il timeout una volta completata l'operazione
        clearTimeout(authTimeout)

        if (error) throw error
        
        console.log("Login completato con successo:", data.user?.id)
        toast.success("Accesso effettuato")
        
        console.log("Inizializzazione store...")
        try {
          await initialize()
          console.log("Store inizializzato")
          
          // Ottieni il ruolo dall'utente nello store o dai metadata
          const userRole = useAuthStore.getState().user?.role || data.user?.user_metadata?.role || 'patient'
          
          console.log("Reindirizzamento in corso in base al ruolo:", userRole)
          
          // Utilizzare router.push invece di window.location.href
          // setTimeout(() => {
            if (userRole === 'therapist') {
              // window.location.href = '/therapist-dashboard'
              router.push('/therapist-dashboard')
            } else {
              // window.location.href = '/patient-dashboard'
              router.push('/patient-dashboard')
            }
          // }, 1000)
        } catch (initError) {
          console.error("Errore durante l'inizializzazione:", initError)
          
          // Anche in caso di errore, tenta di utilizzare il ruolo dai metadata
          const userRole = data.user?.user_metadata?.role || 'patient'
          
          // setTimeout(() => {
            if (userRole === 'therapist') {
              // window.location.href = '/therapist-dashboard'
              router.push('/therapist-dashboard')
            } else {
              // window.location.href = '/patient-dashboard'
              router.push('/patient-dashboard')
            }
          // }, 1000)
        }
      } else {
        // Registrazione
        toast.info("Registrazione in corso...", { id: "signup-toast" })
        
        // 1. Registra l'utente in auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              // Mettiamo il ruolo anche nei metadata dell'utente per sicurezza
              role: role
            }
          }
        })

        // Cancella il timeout
        clearTimeout(authTimeout)

        if (error) throw error

        if (!data.user) {
          throw new Error("Utente non creato correttamente");
        }

        // 2. Attendi un momento per assicurarti che l'utente sia creato
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // 3. Crea il profilo con ruolo
          console.log("Creazione profilo per:", data.user.id, email, role);
          
          // 3.1 Verifica se il profilo esiste già
          const { data: existingProfile, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .maybeSingle();
            
          if (checkError) {
            console.error("Errore verifica profilo:", checkError);
          }
          
          // 3.2 Crea il profilo solo se non esiste già
          if (!existingProfile) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: email,
                role: role
              });

            if (profileError) {
              console.error("Errore dettagliato creazione profilo:", profileError);
              
              // Mostra errore specifico
              if (profileError.code === '23505') {
                toast.error("Profilo già esistente", { id: "signup-toast" });
              } else if (profileError.code === '42501') {
                toast.error("Permessi insufficienti. Controlla le policy RLS", { id: "signup-toast" });
              } else {
                toast.error(`Errore: ${profileError.message || "Errore creazione profilo"}`, { id: "signup-toast" });
              }
            }
          }

          toast.success("Registrazione completata come " + (role === 'therapist' ? 'psicologo' : 'paziente'), { id: "signup-toast" });
          
          console.log("Inizializzazione store dopo registrazione...");
          try {
            await initialize();
            console.log("Store inizializzato");
          } catch (initError) {
            console.error("Errore durante l'inizializzazione:", initError);
          }
          
          // Utilizzare router.push invece di window.location.href
          // setTimeout(() => {
            console.log("Reindirizzamento in base al ruolo scelto:", role);
            if (role === 'therapist') {
              // window.location.href = '/therapist-dashboard'
              router.push('/therapist-dashboard')
            } else {
              // window.location.href = '/patient-dashboard'
              router.push('/patient-dashboard')
            }
          // }, 1000);
        } catch (profileError: any) {
          console.error("Errore dettagliato:", profileError);
          toast.error("Errore nella creazione del profilo", {
            id: "signup-toast",
            description: profileError?.message || "Controlla la console per dettagli"
          });
          
          // Nonostante l'errore del profilo, reindirizza in base al ruolo scelto
          // setTimeout(() => {
            if (role === 'therapist') {
              // window.location.href = '/therapist-dashboard'
              router.push('/therapist-dashboard')
            } else {
              // window.location.href = '/patient-dashboard'
              router.push('/patient-dashboard')
            }
          // }, 1000);
        }
      }
    } catch (error: any) {
      // Cancella il timeout in caso di errore
      clearTimeout(authTimeout)
      
      console.error("Errore di autenticazione:", error);
      
      // Messaggi di errore più leggibili
      let errorMessage = "Si è verificato un errore";
      
      if (error.message?.includes("credentials")) {
        errorMessage = "Email o password non corretti";
      } else if (error.message?.includes("confirm")) {
        errorMessage = "Controlla la tua email per confermare la registrazione";
      } else if (error.message?.includes("already") || error.message?.includes("esistente")) {
        errorMessage = "Email già registrata. Prova ad effettuare l'accesso";
      } else {
        errorMessage = error.message || "Errore sconosciuto";
      }
      
      toast.error("Errore", { 
        id: "signup-toast",
        description: errorMessage 
      });
    } finally {
      // Assicuriamoci che loading venga sempre disattivato
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? 'Accedi' : 'Registrati'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Inserisci le tue credenziali per accedere' 
              : 'Crea un nuovo account'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="nome@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {/* Selezione ruolo (visibile solo durante la registrazione) */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo di account</label>
                <RadioGroup 
                  value={role} 
                  onValueChange={setRole} 
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="patient" id="patient" />
                    <Label htmlFor="patient">Paziente</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="therapist" id="therapist" />
                    <Label htmlFor="therapist">Psicologo/Terapeuta</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading 
                ? 'Caricamento...' 
                : (isLogin ? 'Accedi' : 'Registrati')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin
                ? 'Non hai un account? Registrati'
                : 'Hai già un account? Accedi'}
            </Button>
            
            {/* Pulsante di test per debug */}
            <Button 
              type="button" 
              variant="outline" 
              className="w-full mt-2" 
              onClick={async () => {
                console.log("Test di autenticazione");
                try {
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                  });
                  
                  console.log("Risposta auth:", data, error);
                  
                  if (error) {
                    toast.error("Test fallito", { description: error.message });
                  } else if (data.user) {
                    toast.success("Test riuscito", { description: `ID: ${data.user.id}` });
                  }
                } catch (e) {
                  console.error("Errore nel test:", e);
                  toast.error("Errore imprevisto", { description: String(e) });
                }
              }}
            >
              Test Auth
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}