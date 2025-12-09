//frontend/app/subjects/[id]/study/page.js

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getApiUrl } from '../../../context/AuthContext';

const API_URL = getApiUrl();

export default function SubjectStudyPage() {
  const params = useParams();
  const subjectId = params.id;
  const messagesEndRef = useRef(null);

  const [subject, setSubject] = useState(null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    fetchSubject();
  }, [subjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSubject = async () => {
    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}`);
      const data = await response.json();
      setSubject(data);
    } catch (err) {
      console.error('Error fetching subject:', err);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    const userMessage = {
      role: 'user',
      content: question
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    const formData = new FormData();
    formData.append('question', question);
    formData.append('chat_history', JSON.stringify(messages));

    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}/ask`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get response');
      }

      const data = await response.json();

      const aiMessage = {
        role: 'assistant',
        content: data.response
      };
      setMessages([...updatedMessages, aiMessage]);
      setQuestion('');

    } catch (err) {
      alert(`Error: ${err.message}`);
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (confirm('Clear all messages? This will reset the conversation.')) {
      setMessages([]);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <Link href={`/subjects/${subjectId}`} style={styles.backLink}>
            ← Back to Subject
          </Link>
          {messages.length > 0 && (
            <button onClick={handleClearChat} style={styles.clearButton}>
              🗑️ Clear Chat
            </button>
          )}
        </div>

        {/* Title */}
        <div style={styles.titleCard}>
          <h1 style={styles.title}>🤖 Subject Study Assistant</h1>
          {subject && <p style={styles.subtitle}>📁 {subject.name}</p>}
          <p style={styles.modeInfo}>
            💬 Tutor Mode Only (due to content size)
          </p>
          {messages.length > 0 && (
            <p style={styles.messageCount}>
              💬 {messages.length} messages in this session
            </p>
          )}
        </div>

        {/* Info Banner */}
        <div style={styles.infoBanner}>
          <p>
            ℹ️ This AI has access to ALL lectures across ALL topics in this subject. 
            For practice problems or exams, use the Topic or Lecture study pages for better results.
          </p>
        </div>

        {/* Chat Messages */}
        <div style={styles.messagesContainer}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <h3>👋 Welcome to Subject Study Assistant!</h3>
              <p>This AI can answer questions about your entire subject.</p>
              <p style={styles.hint}>
                Try asking things like:
              </p>
              <ul style={styles.exampleList}>
                <li>"How do the concepts from topic A relate to topic B?"</li>
                <li>"Give me an overview of everything covered so far"</li>
                <li>"What's the most important concept I should know?"</li>
              </ul>
              <p style={styles.memoryNote}>
                💡 <strong>Chat Memory:</strong> The AI remembers your conversation, so you can ask follow-up questions!
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                ...(msg.role === 'user' ? styles.userMessage : styles.aiMessage)
              }}
            >
              <div style={styles.messageHeader}>
                {msg.role === 'user' ? (
                  <span style={styles.messageRole}>You</span>
                ) : (
                  <span style={styles.messageRole}>🤖 AI Tutor</span>
                )}
              </div>
              <div style={styles.messageContent}>
                {msg.content}
              </div>
              
              <button
                onClick={() => handleCopyMessage(msg.content, index)}
                style={styles.copyButton}
                title="Copy to clipboard"
              >
                {copiedIndex === index ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          ))}

          {loading && (
            <div style={styles.loadingMessage}>
              <span>🤖 Analyzing entire subject content...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={styles.inputArea}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ask about anything in this subject..."
            style={styles.textarea}
            rows={3}
          />
          
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            style={{
              ...styles.sendButton,
              ...(loading || !question.trim() ? styles.sendButtonDisabled : {})
            }}
          >
            {loading ? '⏳' : '🚀'} Ask
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  content: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 40px)',
  },
  header: {
    marginBottom: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLink: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  titleCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#333',
    fontWeight: '600',
  },
  modeInfo: {
    fontSize: '14px',
    color: '#0066cc',
    marginTop: '5px',
  },
  messageCount: {
    fontSize: '12px',
    color: '#28a745',
    marginTop: '8px',
  },
  infoBanner: {
    backgroundColor: '#fff3cd',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '15px',
    color: '#856404',
    fontSize: '14px',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '15px',
    overflowY: 'auto',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#666',
  },
  hint: {
    marginTop: '20px',
    fontWeight: '600',
  },
  exampleList: {
    textAlign: 'left',
    display: 'inline-block',
    marginTop: '10px',
    color: '#555',
  },
  memoryNote: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#e8f5e9',
    borderRadius: '8px',
    color: '#2e7d32',
    fontSize: '14px',
  },
  message: {
    marginBottom: '20px',
    padding: '15px',
    borderRadius: '8px',
    position: 'relative',
  },
  userMessage: {
    backgroundColor: '#e3f2fd',
    marginLeft: '60px',
  },
  aiMessage: {
    backgroundColor: '#f5f5f5',
    marginRight: '60px',
  },
  messageHeader: {
    marginBottom: '8px',
  },
  messageRole: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#333',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    fontSize: '15px',
    paddingBottom: '30px',
  },
  copyButton: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
    transition: 'all 0.2s',
  },
  loadingMessage: {
    textAlign: 'center',
    padding: '20px',
    color: '#666',
  },
  inputArea: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '8px',
    display: 'flex',
    gap: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  textarea: {
    flex: 1,
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'none',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '12px 24px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
};