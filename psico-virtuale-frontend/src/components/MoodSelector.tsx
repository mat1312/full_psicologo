// src/components/MoodSelector.tsx
import { useState } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SmileIcon, MehIcon, FrownIcon } from 'lucide-react'

interface MoodSelectorProps {
  onSelect: (mood: string) => void
  onClose: () => void
}

export function MoodSelector({ onSelect, onClose }: MoodSelectorProps) {
  const [selectedMood, setSelectedMood] = useState<string>('')
  
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="font-medium mb-3">Come ti senti oggi?</h3>
      <RadioGroup 
        value={selectedMood} 
        onValueChange={setSelectedMood}
        className="flex flex-col space-y-2 mb-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="positivo" id="positivo" />
          <Label htmlFor="positivo" className="flex items-center">
            <SmileIcon className="h-5 w-5 mr-2 text-green-500" />
            Positivo
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="neutrale" id="neutrale" />
          <Label htmlFor="neutrale" className="flex items-center">
            <MehIcon className="h-5 w-5 mr-2 text-amber-500" />
            Neutrale
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="negativo" id="negativo" />
          <Label htmlFor="negativo" className="flex items-center">
            <FrownIcon className="h-5 w-5 mr-2 text-red-500" />
            Negativo
          </Label>
        </div>
      </RadioGroup>
      <div className="flex justify-end space-x-2">
        <Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button 
          onClick={() => {
            if (selectedMood) {
              onSelect(selectedMood)
              onClose()
            }
          }}
          disabled={!selectedMood}
        >
          Conferma
        </Button>
      </div>
    </div>
  )
}