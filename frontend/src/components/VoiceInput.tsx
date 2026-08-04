import { useState, useRef } from 'react'

interface Props {
  onTranscript: (text: string) => void
}

export default function VoiceInput({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<any>(null)

  const start = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser.')
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ')
      onTranscript(transcript)
    }
    rec.onerror = () => setError('Voice recognition error. Try again.')
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
    setError('')
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          recording
            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
            : 'bg-white text-slate-600 hover:bg-slate-50 shadow-card border border-slate-100'
        }`}
      >
        {recording ? '⏹ Stop recording' : '🎤 Voice input'}
      </button>
      {error && <span className="text-rose-500 text-xs">{error}</span>}
    </div>
  )
}
