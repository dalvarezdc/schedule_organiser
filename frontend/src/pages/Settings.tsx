import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/client'
import { useState } from 'react'

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini'],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
  gemini: [
    'gemini-3.6-pro',
    'gemini-3.6-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ],
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

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20'

export default function Settings() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  if (isLoading || !settings) {
    return <div className="text-slate-400 text-sm">Loading…</div>
  }

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
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="text-lg font-bold text-navy mb-6">Settings</h2>
        <form onSubmit={save} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">AI Provider</h3>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">Provider</label>
              <select
                value={currentProvider}
                onChange={e => {
                  const p = e.target.value
                  const defaultModel = (MODELS_BY_PROVIDER[p] && MODELS_BY_PROVIDER[p][0]) || ''
                  setForm(prev => ({ ...prev, ai_provider: p, ai_model: defaultModel }))
                }}
                className={inputClass}
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
                <label className="block text-xs text-slate-500 mb-1 font-medium">Model</label>
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
                  className={inputClass}
                >
                  {knownModels.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">Custom…</option>
                </select>
                {isCustomModel && (
                  <input
                    {...field('ai_model', '')}
                    placeholder="Type exact model identifier"
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>
            )}
            {currentProvider === 'custom' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">Model</label>
                <input
                  {...field('ai_model', settings.ai_model)}
                  placeholder="model-name"
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                API Key{' '}
                {settings.ai_api_key_set && (
                  <span className="text-brand-tealDark ml-1">✓ set</span>
                )}
              </label>
              <input
                type="password"
                {...field('ai_api_key', '')}
                placeholder={
                  settings.ai_api_key_set
                    ? '••••••••••• (leave blank to keep existing)'
                    : 'Enter API key'
                }
                className={inputClass}
              />
            </div>
            {currentProvider === 'custom' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">Base URL</label>
                <input
                  {...field('ai_base_url', settings.ai_base_url)}
                  placeholder="https://api.openai.com"
                  className={inputClass}
                />
              </div>
            )}
            <p className="text-xs text-slate-400">{PROVIDER_HELP[currentProvider] || ''}</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Notifications
            </h3>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                Slack Webhook URL
              </label>
              <input
                {...field('slack_webhook_url', settings.slack_webhook_url)}
                placeholder="https://hooks.slack.com/..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                Discord Webhook URL
              </label>
              <input
                {...field('discord_webhook_url', settings.discord_webhook_url)}
                placeholder="https://discord.com/api/webhooks/..."
                className={inputClass}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Google Calendar
            </h3>
            <div className="flex items-center gap-3">
              <span
                className={`text-sm ${settings.google_connected ? 'text-brand-tealDark' : 'text-slate-400'}`}
              >
                {settings.google_connected ? '✓ Connected' : 'Not connected'}
              </span>
              <a
                href="/api/integrations/calendar/connect"
                className="text-sm text-brand-blue hover:underline font-medium"
              >
                {settings.google_connected ? 'Reconnect' : 'Connect Google Calendar'}
              </a>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">Calendar ID</label>
              <input
                {...field('google_calendar_id', settings.google_calendar_id)}
                placeholder="primary"
                className={inputClass}
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-navy text-white py-2.5 rounded-xl text-sm font-bold hover:bg-navy-mid disabled:opacity-50 transition-colors shadow-soft"
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
