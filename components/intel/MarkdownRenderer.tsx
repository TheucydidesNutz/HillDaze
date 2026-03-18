'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';

const components: Components = {
  code({ className, children, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-white/10 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="rounded-lg bg-white/[0.06] border border-white/10 p-4 overflow-x-auto my-3">
        <code className={`text-sm font-mono ${className || ''}`} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--intel-primary)] hover:underline"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="w-full border-collapse border border-white/10 text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-white/10 px-3 py-2 text-left bg-white/[0.04] font-medium">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-white/10 px-3 py-2">
        {children}
      </td>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-[var(--intel-primary)] pl-4 my-3 opacity-80 italic">
        {children}
      </blockquote>
    );
  },
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
