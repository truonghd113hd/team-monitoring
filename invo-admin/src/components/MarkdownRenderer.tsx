'use client';

import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { API_BASE_URL } from '@/lib/api-client';

function proxyImageSrc(src: string | undefined): string | undefined {
  if (!src) return src;
  if (src.startsWith('https://github.com/')) {
    return `${API_BASE_URL}/tracker/github/image?url=${encodeURIComponent(src)}`;
  }
  return src;
}

interface Props {
  children: string;
  className?: string;
  components?: Components;
}

export default function MarkdownRenderer({ children, className = '', components }: Props) {
  const defaultComponents: Components = {
    img: ({ src, alt, ...rest }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proxyImageSrc(src)}
        alt={alt ?? ''}
        className="max-w-full rounded-lg my-2"
        loading="lazy"
        {...rest}
      />
    ),
    ...components,
  };

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none
      prose-p:my-1 prose-p:leading-relaxed
      prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
      prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
      prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
      prose-code:text-xs prose-code:bg-slate-100 prose-code:dark:bg-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-slate-100 prose-pre:dark:bg-slate-700 prose-pre:text-xs prose-pre:rounded-lg prose-pre:p-3
      prose-blockquote:border-slate-300 prose-blockquote:dark:border-slate-600 prose-blockquote:text-slate-500 prose-blockquote:my-2
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      prose-strong:font-semibold prose-em:italic
      prose-hr:border-slate-200 prose-hr:dark:border-slate-600
      prose-table:text-xs prose-th:bg-slate-50 prose-th:dark:bg-slate-700
      prose-img:my-2 prose-img:rounded-lg prose-img:max-w-full
      ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={defaultComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
