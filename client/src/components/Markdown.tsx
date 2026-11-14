import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders mentor replies as GitHub-flavoured Markdown (lists, tables, code, emphasis) with Tailwind Typography.
 * Raw HTML in model output is never rendered (react-markdown ignores it without rehype-raw), and links open safely.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-white prose-strong:text-white prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:before:content-none prose-code:after:content-none prose-table:my-2 prose-th:text-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer noopener" className="text-indigo-300 hover:text-indigo-200">{children}</a> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
