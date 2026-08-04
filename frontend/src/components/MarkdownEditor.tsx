import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import Markdown from './Markdown'

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
  '😉', '😍', '🥰', '😘', '😋', '😎', '🤔', '😐', '😑', '😶',
  '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴',
  '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃',
  '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭',
  '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶',
  '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢',
  '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🙏', '✨',
  '⭐', '🔥', '💯', '✅', '❌', '⚠️', '📌', '📎', '🔗', '📝',
  '💡', '🎯', '🚀', '⏰', '📅', '✅', '☑️', '🔔', '💬', '❤️',
]

const COLORS = [
  { label: 'Default', value: '', swatch: 'linear-gradient(135deg, #fff 50%, #cbd5e1 50%)' },
  { label: 'Red', value: 'md-color-red', swatch: '#dc2626' },
  { label: 'Orange', value: 'md-color-orange', swatch: '#ea580c' },
  { label: 'Gold', value: 'md-color-gold', swatch: '#ca8a04' },
  { label: 'Green', value: 'md-color-green', swatch: '#16a34a' },
  { label: 'Teal', value: 'md-color-teal', swatch: '#0d9488' },
  { label: 'Blue', value: 'md-color-blue', swatch: '#2563eb' },
  { label: 'Purple', value: 'md-color-purple', swatch: '#9333ea' },
  { label: 'Pink', value: 'md-color-pink', swatch: '#db2777' },
  { label: 'Gray', value: 'md-color-gray', swatch: '#64748b' },
]

type Align = 'left' | 'center' | 'right'

export interface MarkdownEditorProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onBlur' | 'value' | 'defaultValue'> {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: (value: string) => void
  rows?: number
  minHeight?: number
  /** Show AI improve action on the bottom bar */
  showAiImprove?: boolean
  onAiImprove?: () => void
  aiImproving?: boolean
  /** Start with formatting toolbar visible */
  defaultShowToolbar?: boolean
}

function ToolbarBtn({
  title,
  active,
  onClick,
  children,
  className = '',
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded text-sm transition-colors',
        active
          ? 'bg-slate-200 text-navy'
          : 'text-slate-600 hover:bg-slate-100 hover:text-navy',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" aria-hidden />
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<\/?u>/gi, '')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^(\s*)[-*+]\s+/gm, '$1')
    .replace(/^(\s*)\d+\.\s+/gm, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
}

export default function MarkdownEditor({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onBlur,
  rows = 8,
  minHeight = 160,
  placeholder = 'Write a description… Markdown supported.',
  showAiImprove = false,
  onAiImprove,
  aiImproving = false,
  defaultShowToolbar = true,
  className = '',
  id,
  ...rest
}: MarkdownEditorProps) {
  const isControlled = controlledValue !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const value = isControlled ? controlledValue : internal

  const [showToolbar, setShowToolbar] = useState(defaultShowToolbar)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showColor, setShowColor] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [linkText, setLinkText] = useState('')

  const taRef = useRef<HTMLTextAreaElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selRef = useRef({ start: 0, end: 0 })
  const autoId = useId()
  const fieldId = id || autoId

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const rememberSelection = () => {
    const ta = taRef.current
    if (!ta) return
    selRef.current = { start: ta.selectionStart, end: ta.selectionEnd }
  }

  const applyAtSelection = useCallback(
    (transform: (selected: string, start: number, end: number, full: string) => {
      next: string
      cursorStart: number
      cursorEnd: number
    }) => {
      const ta = taRef.current
      const start = ta?.selectionStart ?? selRef.current.start
      const end = ta?.selectionEnd ?? selRef.current.end
      const selected = value.slice(start, end)
      const { next, cursorStart, cursorEnd } = transform(selected, start, end, value)
      setValue(next)
      requestAnimationFrame(() => {
        const el = taRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(cursorStart, cursorEnd)
        selRef.current = { start: cursorStart, end: cursorEnd }
      })
    },
    [setValue, value],
  )

  const wrap = (before: string, after: string = before, placeholder = 'text') => {
    applyAtSelection((selected, start, end) => {
      const inner = selected || placeholder
      const next = value.slice(0, start) + before + inner + after + value.slice(end)
      if (selected) {
        return {
          next,
          cursorStart: start,
          cursorEnd: start + before.length + selected.length + after.length,
        }
      }
      return {
        next,
        cursorStart: start + before.length,
        cursorEnd: start + before.length + placeholder.length,
      }
    })
  }

  const prefixLines = (prefix: string) => {
    applyAtSelection((_selected, start, end, full) => {
      const lineStart = full.lastIndexOf('\n', start - 1) + 1
      const lineEnd = (() => {
        const n = full.indexOf('\n', end)
        return n === -1 ? full.length : n
      })()
      const block = full.slice(lineStart, lineEnd)
      const lines = block.split('\n')
      const nextBlock = lines
        .map(line => {
          if (prefix === '> ') {
            return line.startsWith('> ') ? line.slice(2) : `> ${line}`
          }
          if (prefix === '- ') {
            if (/^\s*[-*+]\s+/.test(line)) return line.replace(/^\s*[-*+]\s+/, '')
            if (/^\s*\d+\.\s+/.test(line)) return line.replace(/^\s*\d+\.\s+/, '- ')
            return `- ${line}`
          }
          if (prefix === '1. ') {
            if (/^\s*\d+\.\s+/.test(line)) return line.replace(/^\s*\d+\.\s+/, '')
            if (/^\s*[-*+]\s+/.test(line)) return line.replace(/^\s*[-*+]\s+/, '1. ')
            return `1. ${line}`
          }
          return `${prefix}${line}`
        })
        .join('\n')
      const next = full.slice(0, lineStart) + nextBlock + full.slice(lineEnd)
      return {
        next,
        cursorStart: lineStart,
        cursorEnd: lineStart + nextBlock.length,
      }
    })
  }

  const indent = (direction: 'in' | 'out') => {
    applyAtSelection((_selected, start, end, full) => {
      const lineStart = full.lastIndexOf('\n', start - 1) + 1
      const lineEnd = (() => {
        const n = full.indexOf('\n', end)
        return n === -1 ? full.length : n
      })()
      const block = full.slice(lineStart, lineEnd)
      const nextBlock = block
        .split('\n')
        .map(line =>
          direction === 'in'
            ? `  ${line}`
            : line.startsWith('  ')
              ? line.slice(2)
              : line.startsWith('\t')
                ? line.slice(1)
                : line,
        )
        .join('\n')
      const next = full.slice(0, lineStart) + nextBlock + full.slice(lineEnd)
      return {
        next,
        cursorStart: lineStart,
        cursorEnd: lineStart + nextBlock.length,
      }
    })
  }

  const applyHeading = (level: 0 | 1 | 2 | 3) => {
    applyAtSelection((_selected, start, end, full) => {
      const lineStart = full.lastIndexOf('\n', start - 1) + 1
      const lineEnd = (() => {
        const n = full.indexOf('\n', end)
        return n === -1 ? full.length : n
      })()
      const block = full.slice(lineStart, lineEnd)
      const nextBlock = block
        .split('\n')
        .map(line => {
          const bare = line.replace(/^#{1,6}\s+/, '')
          if (level === 0) return bare
          return `${'#'.repeat(level)} ${bare}`
        })
        .join('\n')
      const next = full.slice(0, lineStart) + nextBlock + full.slice(lineEnd)
      return {
        next,
        cursorStart: lineStart,
        cursorEnd: lineStart + nextBlock.length,
      }
    })
  }

  const applyAlign = (align: Align) => {
    applyAtSelection((selected, start, end) => {
      const inner = (selected || 'text').replace(
        /<\/?div\s+class="md-align-(?:left|center|right)"\s*>/gi,
        '',
      )
      const wrapped = `<div class="md-align-${align}">${inner}</div>`
      const next = value.slice(0, start) + wrapped + value.slice(end)
      return {
        next,
        cursorStart: start,
        cursorEnd: start + wrapped.length,
      }
    })
  }

  const applyColor = (colorClass: string) => {
    setShowColor(false)
    if (!colorClass) {
      applyAtSelection((selected, start, end) => {
        const inner = selected.replace(/<\/?span[^>]*>/gi, '') || 'text'
        const next = value.slice(0, start) + inner + value.slice(end)
        return { next, cursorStart: start, cursorEnd: start + inner.length }
      })
      return
    }
    applyAtSelection((selected, start, end) => {
      const bare = (selected || 'text').replace(/<\/?span[^>]*>/gi, '')
      const wrapped = `<span class="${colorClass}">${bare}</span>`
      const next = value.slice(0, start) + wrapped + value.slice(end)
      return {
        next,
        cursorStart: start,
        cursorEnd: start + wrapped.length,
      }
    })
  }

  const clearFormatting = () => {
    applyAtSelection((selected, start, end) => {
      if (!selected) {
        const cleaned = stripMarkdown(value)
        return { next: cleaned, cursorStart: 0, cursorEnd: cleaned.length }
      }
      const cleaned = stripMarkdown(selected)
      const next = value.slice(0, start) + cleaned + value.slice(end)
      return { next, cursorStart: start, cursorEnd: start + cleaned.length }
    })
  }

  const insertText = (text: string) => {
    applyAtSelection((_selected, start, end) => {
      const next = value.slice(0, start) + text + value.slice(end)
      return {
        next,
        cursorStart: start + text.length,
        cursorEnd: start + text.length,
      }
    })
  }

  const openLinkDialog = () => {
    rememberSelection()
    const ta = taRef.current
    const selected = ta
      ? value.slice(ta.selectionStart, ta.selectionEnd)
      : value.slice(selRef.current.start, selRef.current.end)
    setLinkText(selected || '')
    setLinkUrl('https://')
    setShowLink(true)
    setShowEmoji(false)
    setShowColor(false)
    setShowMore(false)
  }

  const insertLink = () => {
    const text = linkText.trim() || linkUrl.trim() || 'link'
    const url = linkUrl.trim() || 'https://'
    const md = `[${text}](${url})`
    // Restore remembered selection then replace
    const { start, end } = selRef.current
    const next = value.slice(0, start) + md + value.slice(end)
    setValue(next)
    setShowLink(false)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(start, start + md.length)
    })
  }

  // Close popovers on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setShowEmoji(false)
        setShowColor(false)
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const k = e.key.toLowerCase()
      if (k === 'b') {
        e.preventDefault()
        wrap('**')
      } else if (k === 'i') {
        e.preventDefault()
        wrap('*')
      } else if (k === 'u') {
        e.preventDefault()
        wrap('<u>', '</u>')
      } else if (k === 'k') {
        e.preventDefault()
        openLinkDialog()
      }
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      indent(e.shiftKey ? 'out' : 'in')
    }
  }

  return (
    <div
      ref={wrapRef}
      className={[
        'border border-slate-200 rounded-xl bg-white overflow-hidden transition-colors',
        'focus-within:border-brand-teal focus-within:ring-2 focus-within:ring-brand-teal/20',
        className,
      ].join(' ')}
    >
      {/* Top formatting bar (Gmail-style) */}
      {showToolbar && mode === 'write' && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/80">
          <select
            className="h-7 text-xs border border-slate-200 rounded-md px-1.5 bg-white text-slate-700 focus:outline-none focus:border-brand-teal"
            defaultValue="0"
            title="Text style"
            onChange={e => {
              applyHeading(Number(e.target.value) as 0 | 1 | 2 | 3)
              e.target.value = '0'
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <option value="0">Normal</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <select
            className="h-7 text-xs border border-slate-200 rounded-md px-1.5 bg-white text-slate-700 focus:outline-none focus:border-brand-teal max-w-[4.5rem]"
            defaultValue="md"
            title="Text size"
            onChange={e => {
              const map: Record<string, 0 | 1 | 2 | 3> = {
                sm: 0,
                md: 0,
                lg: 3,
                xl: 2,
                '2xl': 1,
              }
              const level = map[e.target.value] ?? 0
              if (e.target.value === 'lg' || e.target.value === 'xl' || e.target.value === '2xl') {
                applyHeading(level)
              } else {
                applyHeading(0)
              }
              e.target.value = 'md'
            }}
          >
            <option value="sm">Small</option>
            <option value="md">Normal</option>
            <option value="lg">Large</option>
            <option value="xl">Larger</option>
            <option value="2xl">Huge</option>
          </select>

          <Divider />

          <ToolbarBtn title="Bold (⌘B)" onClick={() => wrap('**')}>
            <span className="font-bold">B</span>
          </ToolbarBtn>
          <ToolbarBtn title="Italic (⌘I)" onClick={() => wrap('*')}>
            <span className="italic font-serif">I</span>
          </ToolbarBtn>
          <ToolbarBtn title="Underline (⌘U)" onClick={() => wrap('<u>', '</u>')}>
            <span className="underline">U</span>
          </ToolbarBtn>

          <div className="relative">
            <ToolbarBtn
              title="Text color"
              active={showColor}
              onClick={() => {
                setShowColor(c => !c)
                setShowEmoji(false)
                setShowMore(false)
              }}
            >
              <span className="flex flex-col items-center leading-none">
                <span className="text-xs font-bold">A</span>
                <span className="w-3.5 h-0.5 rounded-sm bg-rose-500 mt-0.5" />
              </span>
            </ToolbarBtn>
            {showColor && (
              <div className="absolute top-full left-0 z-20 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-card flex flex-wrap gap-1.5 w-[148px]">
                {COLORS.map(c => (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => applyColor(c.value)}
                    className="w-6 h-6 rounded-full border border-slate-200 hover:scale-110 transition-transform"
                    style={{ background: c.swatch }}
                  />
                ))}
              </div>
            )}
          </div>

          <Divider />

          <ToolbarBtn title="Align left" onClick={() => applyAlign('left')}>
            <AlignIcon align="left" />
          </ToolbarBtn>
          <ToolbarBtn title="Align center" onClick={() => applyAlign('center')}>
            <AlignIcon align="center" />
          </ToolbarBtn>
          <ToolbarBtn title="Align right" onClick={() => applyAlign('right')}>
            <AlignIcon align="right" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn title="Numbered list" onClick={() => prefixLines('1. ')}>
            <ListOrderedIcon />
          </ToolbarBtn>
          <ToolbarBtn title="Bulleted list" onClick={() => prefixLines('- ')}>
            <ListBulletIcon />
          </ToolbarBtn>
          <ToolbarBtn title="Decrease indent" onClick={() => indent('out')}>
            <IndentIcon out />
          </ToolbarBtn>
          <ToolbarBtn title="Increase indent" onClick={() => indent('in')}>
            <IndentIcon />
          </ToolbarBtn>
          <ToolbarBtn title="Quote" onClick={() => prefixLines('> ')}>
            <QuoteIcon />
          </ToolbarBtn>
          <ToolbarBtn
            title="Code block"
            onClick={() => wrap('\n```\n', '\n```\n', 'code')}
          >
            <CodeBlockIcon />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn title="Remove formatting" onClick={clearFormatting}>
            <span className="text-xs font-semibold line-through decoration-rose-400">Tx</span>
          </ToolbarBtn>
        </div>
      )}

      {/* Write / Preview body */}
      {mode === 'write' ? (
        <textarea
          {...rest}
          id={fieldId}
          ref={taRef}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          onSelect={rememberSelection}
          onBlur={e => {
            rememberSelection()
            onBlur?.(e.target.value)
          }}
          onKeyDown={onKeyDown}
          className="w-full px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none resize-vertical leading-relaxed bg-white font-sans"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="px-4 py-3 text-sm text-slate-700 overflow-auto"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <p className="text-slate-400 italic">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {/* Link dialog */}
      {showLink && (
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[8rem]">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
              Text
            </span>
            <input
              value={linkText}
              onChange={e => setLinkText(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-brand-teal bg-white"
              placeholder="Link text"
            />
          </label>
          <label className="flex-[2] min-w-[10rem]">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
              URL
            </span>
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-brand-teal bg-white"
              placeholder="https://"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  insertLink()
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={insertLink}
            className="h-[30px] px-3 rounded-md bg-navy text-white text-xs font-bold hover:bg-navy-mid"
          >
            Insert
          </button>
          <button
            type="button"
            onClick={() => setShowLink(false)}
            className="h-[30px] px-2 text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Bottom action bar (Gmail-style) */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-slate-100 bg-slate-50/60 relative">
        <ToolbarBtn
          title="Toggle formatting toolbar"
          active={showToolbar}
          onClick={() => setShowToolbar(s => !s)}
          className="font-semibold tracking-tight"
        >
          <span className="text-xs">
            A<span className="text-[10px] align-sub">a</span>
          </span>
        </ToolbarBtn>

        {showAiImprove && (
          <ToolbarBtn
            title="Help me write (AI improve)"
            onClick={() => onAiImprove?.()}
            className={aiImproving ? 'opacity-50 pointer-events-none' : ''}
          >
            {aiImproving ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-brand-tealDark border-t-transparent rounded-full animate-spin" />
            ) : (
              <WandIcon />
            )}
          </ToolbarBtn>
        )}

        <ToolbarBtn title="Insert link (⌘K)" onClick={openLinkDialog}>
          <LinkIcon />
        </ToolbarBtn>

        <div className="relative">
          <ToolbarBtn
            title="Insert emoji"
            active={showEmoji}
            onClick={() => {
              setShowEmoji(e => !e)
              setShowColor(false)
              setShowMore(false)
            }}
          >
            <span className="text-base leading-none">☺</span>
          </ToolbarBtn>
          {showEmoji && (
            <div className="absolute bottom-full left-0 z-20 mb-1 p-2 bg-white border border-slate-200 rounded-xl shadow-card w-[280px] max-h-[200px] overflow-y-auto">
              <div className="grid grid-cols-10 gap-0.5">
                {EMOJIS.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-base"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      insertText(emoji)
                      setShowEmoji(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <ToolbarBtn
          title={mode === 'write' ? 'Preview markdown' : 'Back to editing'}
          active={mode === 'preview'}
          onClick={() => setMode(m => (m === 'write' ? 'preview' : 'write'))}
        >
          <EyeIcon />
        </ToolbarBtn>

        <div className="relative ml-auto">
          <ToolbarBtn
            title="More options"
            active={showMore}
            onClick={() => {
              setShowMore(m => !m)
              setShowEmoji(false)
              setShowColor(false)
            }}
          >
            <MoreIcon />
          </ToolbarBtn>
          {showMore && (
            <div className="absolute bottom-full right-0 z-20 mb-1 py-1 bg-white border border-slate-200 rounded-lg shadow-card min-w-[180px] text-sm">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  wrap('`')
                  setShowMore(false)
                }}
              >
                Inline code
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  wrap('~~')
                  setShowMore(false)
                }}
              >
                Strikethrough
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  wrap('\n```\n', '\n```\n', 'code')
                  setShowMore(false)
                }}
              >
                Code block
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  clearFormatting()
                  setShowMore(false)
                }}
              >
                Plain text (strip formatting)
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setMode(m => (m === 'write' ? 'preview' : 'write'))
                  setShowMore(false)
                }}
              >
                {mode === 'write' ? 'Preview rendered markdown' : 'Edit source'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ——— Icons ——— */

function AlignIcon({ align }: { align: Align }) {
  const widths =
    align === 'left'
      ? ['w-3.5', 'w-2.5', 'w-3', 'w-2']
      : align === 'right'
        ? ['w-3.5 ml-auto', 'w-2.5 ml-auto', 'w-3 ml-auto', 'w-2 ml-auto']
        : ['w-3.5 mx-auto', 'w-2.5 mx-auto', 'w-3 mx-auto', 'w-2 mx-auto']
  return (
    <span className="flex flex-col gap-0.5 w-3.5">
      {widths.map((w, i) => (
        <span key={i} className={`block h-0.5 bg-current rounded-sm ${w}`} />
      ))}
    </span>
  )
}

function ListOrderedIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M2 3h1v3H2V3zm0 5h1v.5H2.5v.5H3v.5H2V8zm.5 3H2v1h1.5v-.5H3v-.5h-.5V11zM5 3.5h9v1H5v-1zm0 4h9v1H5v-1zm0 4h9v1H5v-1z" />
    </svg>
  )
}

function ListBulletIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="4" r="1.2" />
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="3" cy="12" r="1.2" />
      <path d="M6 3.5h8v1H6v-1zm0 4h8v1H6v-1zm0 4h8v1H6v-1z" />
    </svg>
  )
}

function IndentIcon({ out = false }: { out?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${out ? 'scale-x-[-1]' : ''}`}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M2 3h12v1.2H2V3zm4 4h8v1.2H6V7zm0 4h8v1.2H6V11zM2 6.5l3 2.5-3 2.5V6.5z" />
    </svg>
  )
}

function QuoteIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3 4h4v4c0 2-1 3.5-3 4.5l-.7-1.1C4.5 10.8 5 10 5 9H3V4zm6 0h4v4c0 2-1 3.5-3 4.5l-.7-1.1c1.2-.6 1.7-1.4 1.7-2.4H9V4z" />
    </svg>
  )
}

function CodeBlockIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10" />
    </svg>
  )
}

function WandIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4V2m0 14v-2M8 9H6m12 0h-2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 17.5L7 16M17 7l1.5-1.5M9 15l-6 6 2 0 6-6-2-0z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}
