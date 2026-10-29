'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

/**
 * Renderiza a descrição do produto (texto em Markdown salvo pelo painel admin)
 * respeitando parágrafos, listas, negrito e itálico — em vez de exibir os
 * caracteres de formatação (**, -, etc.) literalmente. react-markdown não
 * interpreta HTML embutido por padrão, então o conteúdo já sai sanitizado.
 * remark-breaks preserva quebras de linha simples (sem linha em branco),
 * mantendo compatível a formatação de descrições antigas já salvas.
 */
export function ProductDescription({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`text-sm text-text-secondary dark:text-stone-300 leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-text-primary dark:text-stone-100">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 mb-3">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-1 mb-3">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => (
            <h3 className="font-semibold text-text-primary dark:text-stone-100 mt-4 mb-1.5 first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="font-semibold text-text-primary dark:text-stone-100 mt-4 mb-1.5 first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="font-semibold text-text-primary dark:text-stone-100 mt-3 mb-1.5 first:mt-0">{children}</h4>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
