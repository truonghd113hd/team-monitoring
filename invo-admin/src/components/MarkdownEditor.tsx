'use client';

import { useRef, useState } from 'react';

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

interface ToolbarAction {
  label: string;
  title: string;
  action: (selected: string) => { text: string; offset: number };
}

const TOOLBAR: ToolbarAction[] = [
  {
    label: 'B',
    title: 'Bold',
    action: (s) => s ? { text: `**${s}**`, offset: 2 } : { text: '**bold**', offset: 2 },
  },
  {
    label: 'I',
    title: 'Italic',
    action: (s) => s ? { text: `_${s}_`, offset: 1 } : { text: '_italic_', offset: 1 },
  },
  {
    label: 'S',
    title: 'Strikethrough',
    action: (s) => s ? { text: `~~${s}~~`, offset: 2 } : { text: '~~text~~', offset: 2 },
  },
  {
    label: '`',
    title: 'Inline Code',
    action: (s) => s ? { text: `\`${s}\``, offset: 1 } : { text: '`code`', offset: 1 },
  },
  {
    label: '</>',
    title: 'Code Block',
    action: (s) => ({ text: `\`\`\`\n${s || 'code'}\n\`\`\``, offset: 4 }),
  },
  {
    label: 'H',
    title: 'Heading',
    action: (s) => ({ text: `## ${s || 'Heading'}`, offset: 3 }),
  },
  {
    label: '•',
    title: 'Bullet List',
    action: (s) => {
      const lines = (s || 'item').split('\n').map(l => `- ${l}`).join('\n');
      return { text: lines, offset: 2 };
    },
  },
  {
    label: '1.',
    title: 'Numbered List',
    action: (s) => {
      const lines = (s || 'item').split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
      return { text: lines, offset: 3 };
    },
  },
  {
    label: '>',
    title: 'Blockquote',
    action: (s) => {
      const lines = (s || 'quote').split('\n').map(l => `> ${l}`).join('\n');
      return { text: lines, offset: 2 };
    },
  },
  {
    label: '🔗',
    title: 'Link',
    action: (s) => ({ text: `[${s || 'text'}](url)`, offset: 1 }),
  },
];

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre class="bg-slate-100 dark:bg-slate-700 rounded p-2 overflow-x-auto text-xs my-1"><code>${code.trim()}</code></pre>`
  );

  // Headings
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="font-bold text-base mt-2">$1</h3>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="font-bold text-lg mt-2">$1</h2>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="font-bold text-xl mt-2">$1</h1>');

  // Blockquote
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-4 border-slate-300 pl-3 italic text-slate-500 my-1">$1</blockquote>');

  // Lists
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, (_, n, item) =>
    `<div class="flex gap-1"><span class="min-w-[1.2em]">${n}.</span><span>${item}</span></div>`
  );
  html = html.replace(/^[-*]\s+(.+)$/gm, '<div class="flex gap-1"><span>•</span><span>$1</span></div>');

  // Inline styles
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs font-mono">$1</code>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-500 underline" target="_blank" rel="noopener">$1</a>');

  // Paragraphs
  html = html.split('\n').map(line => {
    if (!line.trim()) return '<br/>';
    if (line.startsWith('<')) return line;
    return `<span>${line}</span><br/>`;
  }).join('');

  return html;
}

export default function MarkdownEditor({ value, onChange, placeholder, rows = 6, className = '' }: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyAction = (action: ToolbarAction) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const { text, offset } = action.action(selected);
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + offset + (selected ? selected.length : (text.length - offset * 2));
      ta.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className={`border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden ${className}`}>
      {/* Tabs + Toolbar */}
      <div className="flex items-center gap-0 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'write'
              ? 'border-primary text-primary bg-white dark:bg-slate-800'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'preview'
              ? 'border-primary text-primary bg-white dark:bg-slate-800'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Preview
        </button>

        {tab === 'write' && (
          <div className="flex items-center gap-0.5 ml-2 flex-wrap">
            {TOOLBAR.map((t) => (
              <button
                key={t.title}
                type="button"
                title={t.title}
                onClick={() => applyAction(t)}
                className="px-1.5 py-0.5 text-[11px] font-mono rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 dark:bg-slate-800 dark:text-white text-sm focus:outline-none resize-none font-mono"
        />
      ) : (
        <div
          className="px-3 py-2 dark:bg-slate-800 dark:text-white text-sm min-h-[6rem] leading-relaxed"
          style={{ minHeight: `${rows * 1.75}rem` }}
          dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : `<span class="text-slate-400">${placeholder || 'Nothing to preview'}</span>` }}
        />
      )}
    </div>
  );
}
