import React from 'react';

/**
 * Format inline markdown: bold (**), italic (*), inline code (`), links ([text](url))
 */
function renderInline(text) {
  if (!text) return text;

  // Split by inline code first to avoid styling inside code
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code
          key={pIdx}
          className="px-1.5 py-0.5 bg-gray-100 text-blue-600 rounded font-mono text-xs font-semibold mx-0.5 border border-gray-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold, italic, and links inside normal text
    // Replace **bold**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 3) {
        return (
          <strong key={`${pIdx}-${bIdx}`} className="font-bold text-gray-900">
            {bPart.slice(2, -2)}
          </strong>
        );
      }

      // Replace *italic*
      const italicParts = bPart.split(/(\*[^*]+\*)/g);
      return italicParts.map((iPart, iIdx) => {
        if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
          return (
            <em key={`${pIdx}-${bIdx}-${iIdx}`} className="italic text-gray-800">
              {iPart.slice(1, -1)}
            </em>
          );
        }

        // Replace markdown links [text](url)
        const linkParts = iPart.split(/(\[[^\]]+\]\([^)]+\))/g);
        return linkParts.map((lPart, lIdx) => {
          const match = lPart.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (match) {
            return (
              <a
                key={`${pIdx}-${bIdx}-${iIdx}-${lIdx}`}
                href={match[2]}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline font-semibold hover:text-blue-800"
              >
                {match[1]}
              </a>
            );
          }
          return lPart;
        });
      });
    });
  });
}

/**
 * Parses markdown into structured blocks:
 * headings, blockquotes, code blocks, tables, lists, horizontal rules, paragraphs
 */
export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks = [];
  let currentList = null;
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeLanguage = '';
  let inTable = false;
  let tableRows = [];

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  const flushCodeBlock = () => {
    if (inCodeBlock) {
      blocks.push({
        type: 'code_block',
        language: codeLanguage,
        code: codeBlockLines.join('\n')
      });
      inCodeBlock = false;
      codeBlockLines = [];
      codeLanguage = '';
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      blocks.push({
        type: 'table',
        rows: tableRows
      });
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Code Block Fence
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // 2. Table row (| col1 | col2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      // Check if separator row (|:---|:---|)
      const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(line);
      if (!isSeparator) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // 3. Horizontal Rule
    if (line === '---' || line === '***' || line === '___') {
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }

    // 4. Headings (#, ##, ###, ####)
    if (line.startsWith('#')) {
      flushList();
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        blocks.push({ type: 'heading', level, text });
        continue;
      }
    }

    // 5. Blockquotes (> ...)
    if (line.startsWith('>')) {
      flushList();
      const quoteText = line.replace(/^>\s*/, '');
      blocks.push({ type: 'blockquote', text: quoteText });
      continue;
    }

    // 6. Unordered List (*, -)
    if (/^[\*\-]\s+/.test(line)) {
      const itemText = line.replace(/^[\*\-]\s+/, '');
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(itemText);
      continue;
    }

    // 7. Ordered List (1. ...)
    if (/^\d+\.\s+/.test(line)) {
      const itemText = line.replace(/^\d+\.\s+/, '');
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(itemText);
      continue;
    }

    // Empty line
    if (!line) {
      flushList();
      continue;
    }

    // Normal Paragraph
    flushList();
    blocks.push({ type: 'paragraph', text: rawLine });
  }

  flushList();
  flushCodeBlock();
  flushTable();

  return (
    <div className={`space-y-4 text-gray-800 text-sm sm:text-base leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1
                  key={idx}
                  className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight pt-2 pb-1 border-b border-gray-200"
                >
                  {renderInline(block.text)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={idx}
                  className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight pt-4 pb-1 border-b border-gray-100 flex items-center gap-2"
                >
                  {renderInline(block.text)}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={idx}
                  className="text-base sm:text-lg font-bold text-gray-800 pt-2"
                >
                  {renderInline(block.text)}
                </h3>
              );
            }
            return (
              <h4 key={idx} className="text-sm font-bold text-gray-800 pt-1">
                {renderInline(block.text)}
              </h4>
            );
          }

          case 'paragraph':
            return (
              <p key={idx} className="text-gray-700 leading-relaxed">
                {renderInline(block.text)}
              </p>
            );

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="my-3 p-4 bg-blue-50/70 border-l-4 border-blue-500 rounded-r-2xl text-blue-950 text-xs sm:text-sm shadow-xs"
              >
                {renderInline(block.text)}
              </blockquote>
            );

          case 'code_block':
            return (
              <div key={idx} className="my-4 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                {block.language && (
                  <div className="bg-gray-800 text-gray-400 px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider">
                    {block.language}
                  </div>
                )}
                <pre className="p-4 bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto leading-relaxed">
                  <code>{block.code}</code>
                </pre>
              </div>
            );

          case 'table':
            return (
              <div key={idx} className="my-4 overflow-x-auto rounded-2xl border border-gray-200 shadow-xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  {block.rows.length > 0 && (
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase text-[11px]">
                      <tr>
                        {block.rows[0].map((cell, cIdx) => (
                          <th key={cIdx} className="p-3">
                            {renderInline(cell)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-gray-100">
                    {block.rows.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-gray-50/50">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-3 text-gray-700">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'ul':
            return (
              <ul key={idx} className="space-y-1.5 pl-5 list-disc text-gray-700 my-2">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={idx} className="space-y-1.5 pl-5 list-decimal text-gray-700 my-2">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="leading-relaxed">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );

          case 'hr':
            return <hr key={idx} className="my-6 border-gray-200" />;

          default:
            return null;
        }
      })}
    </div>
  );
}
