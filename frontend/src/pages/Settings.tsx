import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/client'
import { useState } from 'react'

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  gemini: ['gemini-3.6-pro', 'gemini-3.6-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  grok: ['grok-4.5', 'grok-4', 'grok-4-latest', 'grok-3', 'grok-3-mini'],
  custom: [],
}

const PROVIDER_HELP: Record<string, string> = {
  openai: 'Get your API key at platform.openai.com',
  anthropic: 'Get your API key at console.anthropic.com',
  gemini: 'Get your API key at aistudio.google.com',
  grok: 'Get your API key at console.x.ai',
  custom: 'Use any OpenAI-compatible endpoint (Ollama, Groq, Together AI, etc.)',
}

export default function Settings() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  if (isLoading || !settings) return <div className="p-8 text-gray-400">Loading...</div>

  const val = (field: string, fallback: string) => form[field] ?? fallback

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await updateSettings({
      ai_provider: val('ai_provider', settings.ai_provider),
      ai_model: val('ai_model', settings.ai_model),
      ai_base_url: val('ai_base_url', settings.ai_base_url),
      ai_api_key: form['ai_api_key'] || undefined,
      slack_webhook_url: val('slack_webhook_url', settings.slack_webhook_url),
      discord_webhook_url: val('discord_webhook_url', settings.discord_webhook_url),
      google_calendar_id: val('google_calendar_id', settings.google_calendar_id),
    })
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = (key: string, defaultVal: string) => ({
    value: val(key, defaultVal),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  const currentProvider = val('ai_provider', settings.ai_provider)
  const knownModels = MODELS_BY_PROVIDER[currentProvider] || []
  const currentModel = val('ai_model', settings.ai_model)
  const isCustomModel = currentProvider === 'custom' || !knownModels.includes(currentModel)

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
      <form onSubmit={save} className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">AI Provider</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Provider</label>
            <select
              value={currentProvider}
              onChange={e => {
                const p = e.target.value
                const defaultModel = (MODELS_BY_PROVIDER[p] && MODELS_BY_PROVIDER[p][0]) || ''
                setForm(prev => ({ ...prev, ai_provider: p, ai_model: defaultModel }))
              }}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
              <option value="grok">xAI Grok</option>
              <option value="custom">Custom (OpenAI-compatible)</option>
            </select>
          </div>
          {currentProvider !== 'custom' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Model</label>
              <select
                value={isCustomModel ? '__custom__' : currentModel}
                onChange={e => {
                  const v = e.target.value
                  if (v === '__custom__') {
                    setForm(prev => ({ ...prev, ai_model: '' }))
                  } else {
                    setForm(prev => ({ ...prev, ai_model: v }))
                  }
                }}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {knownModels.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Custom…</option>
              </select>
              {isCustomModel && (
                <input
                  {...field('ai_model', '')}
                  placeholder="Type exact model identifier"
                  className="w-full border rounded px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
          )}
          {currentProvider === 'custom' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Model</label>
              <input {...field('ai_model', settings.ai_model)} placeholder="model-name" className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              API Key {settings.ai_api_key_set && <span className="text-green-500 ml-1">✓ set</span>}
            </label>
            <input
              type="password"
              {...field('ai_api_key', '')}
              placeholder={settings.ai_api_key_set ? '••••••••••• (leave blank to keep existing)' : 'Enter API key'}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          {currentProvider === 'custom' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Base URL</label>
              <input {...field('ai_base_url', settings.ai_base_url)} placeholder="https://api.openai.com" className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          <p className="text-xs text-gray-400">{PROVIDER_HELP[currentProvider] || ''}</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">Notifications</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slack Webhook URL</label>
            <input {...field('slack_webhook_url', settings.slack_webhook_url)} placeholder="https://hooks.slack.com/..." className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Discord Webhook URL</label>
            <input {...field('discord_webhook_url', settings.discord_webhook_url)} placeholder="https://discord.com/api/webhooks/..." className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">Google Calendar</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${settings.google_connected ? 'text-green-600' : 'text-gray-400'}`}>
              {settings.google_connected ? '✓ Connected' : 'Not connected'}
            </span>
            <a href="/api/integrations/calendar/connect" className="text-sm text-blue-600 hover:underline">
              {settings.google_connected ? 'Reconnect' : 'Connect Google Calendar'}
            </a>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Calendar ID</label>
            <input {...field('google_calendar_id', settings.google_calendar_id)} placeholder="primary" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}
