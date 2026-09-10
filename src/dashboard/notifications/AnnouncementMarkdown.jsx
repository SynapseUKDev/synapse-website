import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const SKIP = () => null

const SIZE_CLASS = /^announcement-size--(sm|md|lg|xl)$/

function sizeClassFrom(className) {
  return String(className || '')
    .split(/\s+/)
    .find((name) => SIZE_CLASS.test(name))
}

function alignStyle(props) {
  const align = props.align
  if (align === 'center' || align === 'left' || align === 'right') {
    return { textAlign: align }
  }
  return undefined
}

/** Extra blank lines are collapsed by markdown; keep them so popup spacing matches the editor. */
function preserveExtraSpacing(source) {
  return String(source).replace(/\n{3,}/g, (blank) => {
    const extra = Math.min(blank.length - 2, 8)
    return `\n\n<div class="announcement-md-gap" style="height:${extra * 12}px"></div>\n\n`
  })
}

const components = {
  script: SKIP,
  iframe: SKIP,
  object: SKIP,
  embed: SKIP,
  form: SKIP,
  input: SKIP,
  style: SKIP,
  link: SKIP,
  meta: SKIP,
  base: SKIP,
  br: () => <br />,
  p: ({ children, ...props }) => <p style={alignStyle(props)}>{children}</p>,
  span: ({ children, className }) => {
    const size = sizeClassFrom(className)
    return size ? <span className={size}>{children}</span> : <span>{children}</span>
  },
  div: ({ children, className, ...props }) => {
    if (className === 'announcement-md-gap') {
      return <div className="announcement-md-gap" style={props.style} aria-hidden />
    }
    const size = sizeClassFrom(className)
    const classes = [size, className].filter(Boolean).join(' ')
    return (
      <div className={classes || undefined} style={alignStyle(props)}>
        {children}
      </div>
    )
  },
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  a: ({ href, children }) => {
    const url = typeof href === 'string' ? href.trim() : ''
    const external = /^https?:\/\//i.test(url)
    const inApp = url.startsWith('/') && !url.startsWith('//')
    if (!external && !inApp) return <span>{children}</span>
    return (
      <a href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    )
  },
  img: ({ src, alt }) => {
    if (!/^https?:\/\//i.test(src || '')) return null
    return <img src={src} alt={alt || ''} />
  },
}

export function announcementPlainPreview(text, max = 140) {
  const plain = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max)}…`
}

export default function AnnouncementMarkdown({ children }) {
  const source = preserveExtraSpacing(children)
  if (!source.trim()) return null
  return (
    <div className="announcement-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
