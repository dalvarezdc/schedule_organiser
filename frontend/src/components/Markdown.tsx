import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Schema } from 'hast-util-sanitize'

/** Allow safe HTML used by the formatting toolbar (underline, color, align). */
const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'u', 'span'],
  attributes: {
    ...defaultSchema.attributes,
    // Allow formatting classes from the editor toolbar (md-color-*, md-align-*)
    span: [...(defaultSchema.attributes?.span || []), ['className', /^md-[\w-]+$/]],
    div: [...(defaultSchema.attributes?.div || []), ['className', /^md-[\w-]+$/]],
    u: [],
    a: [...(defaultSchema.attributes?.a || []), 'target', 'rel'],
  },
}

interface Props {
  content: string
  className?: string
}

export default function Markdown({ content, className = '' }: Props) {
  if (!content?.trim()) return null

  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
