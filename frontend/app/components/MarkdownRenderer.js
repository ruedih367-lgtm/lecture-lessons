// frontend/app/components/MarkdownRenderer.js
// Simple markdown renderer with table support - no external dependencies

'use client';

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const renderMarkdown = (text) => {
    const elements = [];
    const lines = text.split('\n');
    let i = 0;
    let keyIndex = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Check for table (line starts with |)
      if (line.trim().startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          elements.push(renderTable(tableLines, keyIndex++));
        }
        continue;
      }

      // Check for code block
      if (line.trim().startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // Skip closing ```
        elements.push(
          <pre key={keyIndex++} style={styles.codeBlock}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        continue;
      }

      // Check for headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={keyIndex++} style={styles.h3}>{renderInline(line.slice(4))}</h3>);
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={keyIndex++} style={styles.h2}>{renderInline(line.slice(3))}</h2>);
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        elements.push(<h1 key={keyIndex++} style={styles.h1}>{renderInline(line.slice(2))}</h1>);
        i++;
        continue;
      }

      // Check for bullet points
      if (line.trim().match(/^[-*•]\s/)) {
        const listItems = [];
        while (i < lines.length && lines[i].trim().match(/^[-*•]\s/)) {
          listItems.push(lines[i].trim().replace(/^[-*•]\s/, ''));
          i++;
        }
        elements.push(
          <ul key={keyIndex++} style={styles.ul}>
            {listItems.map((item, idx) => (
              <li key={idx} style={styles.li}>{renderInline(item)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // Check for numbered list
      if (line.trim().match(/^\d+[.)]\s/)) {
        const listItems = [];
        while (i < lines.length && lines[i].trim().match(/^\d+[.)]\s/)) {
          listItems.push(lines[i].trim().replace(/^\d+[.)]\s/, ''));
          i++;
        }
        elements.push(
          <ol key={keyIndex++} style={styles.ol}>
            {listItems.map((item, idx) => (
              <li key={idx} style={styles.li}>{renderInline(item)}</li>
            ))}
          </ol>
        );
        continue;
      }

      // Empty line = paragraph break
      if (line.trim() === '') {
        elements.push(<div key={keyIndex++} style={styles.paragraphBreak} />);
        i++;
        continue;
      }

      // Regular paragraph
      elements.push(<p key={keyIndex++} style={styles.paragraph}>{renderInline(line)}</p>);
      i++;
    }

    return elements;
  };

  const renderTable = (tableLines, key) => {
    const rows = tableLines
      .filter(line => !line.trim().match(/^\|[-:\s|]+\|$/))
      .map(line => 
        line.split('|').slice(1, -1).map(cell => cell.trim())
      );

    if (rows.length === 0) return null;

    const headerRow = rows[0];
    const bodyRows = rows.slice(1);

    return (
      <div key={key} style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {headerRow.map((cell, idx) => (
                <th key={idx} style={styles.th}>{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIdx) => (
              <tr key={rowIdx} style={rowIdx % 2 === 0 ? {} : styles.trAlt}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} style={styles.td}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderInline = (text) => {
    if (!text) return text;

    // Handle inline code, bold, and italic
    const parts = [];
    let remaining = text;
    let idx = 0;

    while (remaining.length > 0) {
      // Check for inline code
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(<code key={idx++} style={styles.inlineCode}>{codeMatch[1]}</code>);
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Check for bold
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(<strong key={idx++} style={styles.bold}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Check for italic
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        parts.push(<em key={idx++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Find next special character
      const nextSpecial = remaining.search(/[`*]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        // Single special char, treat as text
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts.length === 1 ? parts[0] : parts;
  };

  return <div style={styles.container}>{renderMarkdown(content)}</div>;
}

const styles = {
  container: { lineHeight: '1.6', fontSize: '15px' },
  paragraph: { margin: '0 0 12px 0' },
  paragraphBreak: { height: '8px' },
  h1: { fontSize: '22px', fontWeight: '700', margin: '20px 0 12px 0', color: '#1a1a1a' },
  h2: { fontSize: '18px', fontWeight: '600', margin: '18px 0 10px 0', color: '#1a1a1a' },
  h3: { fontSize: '16px', fontWeight: '600', margin: '16px 0 8px 0', color: '#333' },
  bold: { fontWeight: '600', color: '#1a1a1a' },
  ul: { margin: '8px 0 12px 0', paddingLeft: '24px' },
  ol: { margin: '8px 0 12px 0', paddingLeft: '24px' },
  li: { margin: '4px 0' },
  tableWrapper: { overflowX: 'auto', margin: '16px 0' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: '14px', border: '1px solid #ddd' },
  th: { backgroundColor: '#f5f5f5', padding: '10px 12px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #ddd', borderRight: '1px solid #ddd' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eee', borderRight: '1px solid #eee' },
  trAlt: { backgroundColor: '#fafafa' },
  codeBlock: { backgroundColor: '#1e1e1e', color: '#d4d4d4', padding: '16px', borderRadius: '6px', overflow: 'auto', fontSize: '13px', fontFamily: 'Consolas, Monaco, "Courier New", monospace', margin: '12px 0' },
  inlineCode: { backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'Consolas, Monaco, "Courier New", monospace', color: '#e83e8c' },
};