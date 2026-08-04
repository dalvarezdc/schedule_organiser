import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/client'
import { useState } from 'react'

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

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
      <form onSubmit={save} className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">AI Provider</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Provider</label>
            <select {...field('ai_provider', settings.ai_provider)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="custom">Custom (OpenAI-compatible)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model</label>
            <input {...field('ai_model', settings.ai_model)} className="w-full border rounded px-3 py-2 text-sm" placeholder="gpt-4o" />
          </div>
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
          <div>
            <label className="block text-xs text-gray-400 mb-1">Base URL (for custom endpoint)</label>
            <input {...field('ai_base_url', settings.ai_base_url)} placeholder="https://api.openai.com" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
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
