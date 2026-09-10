import { useEffect, useState } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

const underlineCommand = {
  name: 'underline',
  keyCommand: 'underline',
  buttonProps: { 'aria-label': 'Underline', title: 'Underline' },
  icon: (
    <svg width="12" height="12" viewBox="0 0 16 16" role="img">
      <path
        fill="currentColor"
        d="M4 2v6.2c0 2.2 1.7 3.6 4 3.6s4-1.4 4-3.6V2H10v6.1c0 1.1-.8 1.8-2 1.8s-2-.7-2-1.8V2H4zm-1 12h10v1.4H3V14z"
      />
    </svg>
  ),
  execute: (state, api) => {
    api.replaceSelection(`<u>${state.selectedText || 'underlined text'}</u>`)
  },
}

const centerCommand = {
  name: 'center',
  keyCommand: 'center',
  buttonProps: { 'aria-label': 'Centre text', title: 'Centre' },
  icon: (
    <svg width="12" height="12" viewBox="0 0 16 16" role="img">
      <path fill="currentColor" d="M2 3h12v1.4H2zm2.5 4h7v1.4h-7zM2 11h12v1.4H2z" />
    </svg>
  ),
  execute: (state, api) => {
    const selected = state.selectedText || 'centered text'
    api.replaceSelection(`<div align="center">\n\n${selected}\n\n</div>`)
  },
}

const SIZE_OPTIONS = [
  { name: 'size-sm', label: 'Small', short: 'S', className: 'announcement-size--sm' },
  { name: 'size-md', label: 'Default', short: 'M', className: 'announcement-size--md' },
  { name: 'size-lg', label: 'Large', short: 'L', className: 'announcement-size--lg' },
  { name: 'size-xl', label: 'Extra large', short: 'XL', className: 'announcement-size--xl' },
]

function sizeCommand({ name, label, short, className }) {
  return {
    name,
    keyCommand: name,
    buttonProps: { 'aria-label': label, title: label },
    icon: <span className="admin-announcement-size-label">{short}</span>,
    execute: (state, api) => {
      const selected = state.selectedText || 'text'
      api.replaceSelection(`<div class="${className}">\n\n${selected}\n\n</div>`)
    },
  }
}

const fontSizeGroup = commands.group(
  SIZE_OPTIONS.map(sizeCommand),
  {
    name: 'font-size',
    groupName: 'font-size',
    buttonProps: { 'aria-label': 'Font size', title: 'Font size' },
    icon: (
      <svg width="14" height="12" viewBox="0 0 14 12" role="img">
        <text x="0" y="11" fontSize="11" fontWeight="800" fill="currentColor">
          A
        </text>
        <text x="7" y="11" fontSize="8" fontWeight="800" fill="currentColor">
          a
        </text>
      </svg>
    ),
  }
)

function editorCommands() {
  const next = []
  for (const command of commands.getCommands()) {
    if (command.name === 'comment' || command.name === 'issue') continue
    next.push(command)
    if (command.name === 'italic') next.push(underlineCommand, centerCommand, fontSizeGroup)
  }
  return next
}

const EDITOR_COMMANDS = editorCommands()

function readColorMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export default function AnnouncementEditor({ value, onChange, placeholder }) {
  const [colorMode, setColorMode] = useState(readColorMode)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setColorMode(readColorMode())
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="admin-announcement-editor" data-color-mode={colorMode}>
      <span>Body</span>
      <MDEditor
        value={value}
        onChange={(next) => onChange(next || '')}
        preview="live"
        height={280}
        visibleDragbar={false}
        commands={EDITOR_COMMANDS}
        textareaProps={{ placeholder, maxLength: 8000 }}
      />
    </div>
  )
}
