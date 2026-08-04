import { useState } from 'react'
import { parseText } from '../api/client'
import type { ParsedTask } from '../types'
import VoiceInput from '../components/VoiceInput'
import ParsePreview from '../components/ParsePreview'

export default function InputPanel() {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ParsedTask[] | null>(null)

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setError('')
    try {
      const result = await parseText(text)
      if (result.tasks.length === 0) {
        setError('No tasks were found in your text. Try being more specific.')
        return
      }
      setPreview(result.tasks)
    } catch (e: any) {
      const detail = e?.response?.data?.detail || ''
      if (detail.includes('API key')) {
        setError('AI API key not configured. Go to Settings to add your key.')
      } else {
        setError(detail || 'Parsing failed. Check your AI settings.')
      }
    } finally {
      setParsing(false)
    }
  }

  const handleVoiceTranscript = (transcript: string) => {
    setText(prev => prev ? `${prev} ${transcript}` : transcript)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleParse()
    }
  }

  if (preview) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ParsePreview
          tasks={preview}
          onConfirm={() => { setText(''); setPreview(null) }}
          onCancel={() => setPreview(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">What do you need to do?</h1>
        <p className="text-gray-400 text-sm">
          Write freely — the AI will draft tickets with tasks and subtasks for you to review.
        </p>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. I need to finish the Q3 report by Friday. It needs a data section, an executive summary, and sign-off from the team. Also book a dentist and call the accountant about taxes before end of month..."
      rows={14}
      autoFocus
      className="w-full border border-slate-200 rounded-2xl p-5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all leading-relaxed"
        />
        <div className="absolute bottom-4 right-4 text-xs text-gray-300 pointer-events-none">
          {text.trim() ? '⌘↵ to suggest' : ''}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <VoiceInput onTranscript={handleVoiceTranscript} />
        <button
          onClick={handleParse}
          disabled={parsing || !text.trim()}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-2"
        >
          {parsing ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Thinking…
            </>
          ) : (
            'Suggest tickets →'
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
