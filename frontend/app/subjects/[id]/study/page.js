//frontend/app/subjects/[id]/study/page.js

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth, getApiUrl } from '../../../context/AuthContext';
import MarkdownRenderer from '../../../components/MarkdownRenderer';

const API_URL = getApiUrl();

export default function SubjectStudyPage() {
  const params = useParams();
  const subjectId = params.id;
  const messagesEndRef = useRef(null);
  const { authFetch, isAuthenticated } = useAuth();

  const [subject, setSubject] = useState(null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [likedIndex, setLikedIndex] = useState(null);
  const [learningStatus, setLearningStatus] = useState(null);

  useEffect(() => {
    fetchSubject();
    if (isAuthenticated) {
      fetchLearningStatus();
    }
  }, [subjectId, isAuthenticated]);

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

  const fetchLearningStatus = async () => {
    try {
      const response = await authFetch(`${API_URL}/learning/status`);
      if (response.ok) {
        const data = await response.json();
        setLearningStatus(data);
      }
    } catch (err) {
      console.error('Error fetching learning status:', err);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    const userMessage = { role: 'user', content: question };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    const formData = new FormData();
    formData.append('question', question);
    formData.append('chat_history', JSON.stringify(messages));

    try {
      const response = await authFetch(`${API_URL}/subjects/${subjectId}/ask`, {
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
        content: data.response,
        liked: false,
        questionAsked: question
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

  const handleLikeResponse = async (index) => {
    if (!isAuthenticated) {
      alert('Log in to enable personalized learning!');
      return;
    }

    const msg = messages[index];
    if (msg.role !== 'assistant' || msg.liked) return;

    try {
      const formData = new FormData();
      formData.append('response_content', msg.content);
      formData.append('question_asked', msg.questionAsked || 'Unknown');
      formData.append('mode', 'tutor');

      const response = await authFetch(`${API_URL}/responses/like`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const updatedMessages = [...messages];
        updatedMessages[index] = { ...msg, liked: true };
        setMessages(updatedMessages);
        setLikedIndex(index);
        setTimeout(() => setLikedIndex(null), 2000);
        fetchLearningStatus();
      }
    } catch (err) {
      console.error('Error liking response:', err);
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
    if (confirm('Clear all messages?')) {
      setMessages([]);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <Link href={`/subjects/${subjectId}`} style={styles.backLink}>← Back to Subject</Link>
          {messages.length > 0 && (
            <button onClick={handleClearChat} style={styles.clearButton}>🗑️ Clear Chat</button>
          )}
        </div>

        <div style={styles.titleCard}>
          <h1 style={styles.title}>🤖 Subject Study Assistant</h1>
          {subject && <p style={styles.subtitle}>📁 {subject.name}</p>}
          <p style={styles.modeInfo}>💬 Tutor Mode Only (due to content size)</p>
          {learningStatus?.status === 'active' && (
            <div style={styles.statusBadge}>✨ AI personalized ({learningStatus.total_likes} likes)</div>
          )}
        </div>

        <div style={styles.infoBanner}>
          <p>
            ℹ️ This AI has access to ALL lectures across ALL topics in this subject. 
            For practice problems or exams, use the Topic or Lecture study pages for better results.
          </p>
        </div>

        <div style={styles.messagesContainer}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <h3>👋 Welcome to Subject Study Assistant!</h3>
              <p>This AI can answer questions about your entire subject.</p>
              <p style={styles.hint}>Try asking things like:</p>
              <ul style={styles.exampleList}>
                <li>"How do the concepts from topic A relate to topic B?"</li>
                <li>"Give me an overview of everything covered so far"</li>
                <li>"Compare X and Y in a table"</li>
              </ul>
              <p style={styles.tableTip}>
                💡 <strong>Tip:</strong> Ask for comparisons or data in table format!
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              style={{ ...styles.message, ...(msg.role === 'user' ? styles.userMessage : styles.aiMessage) }}
            >
              <div style={styles.messageHeader}>
                <span style={styles.messageRole}>
                  {msg.role === 'user' ? 'You' : '🤖 AI Tutor'}
                </span>
              </div>
              <div style={styles.messageContent}>
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
              
              {msg.role === 'assistant' && (
                <div style={styles.messageActions}>
                  <button
                    onClick={() => handleLikeResponse(index)}
                    disabled={msg.liked}
                    style={{
                      ...styles.likeButton,
                      ...(msg.liked ? styles.likedButton : {}),
                      ...(likedIndex === index ? styles.justLiked : {})
                    }}
                  >
                    {msg.liked ? '✓ Liked' : '👍 Helpful'}
                  </button>
                  <button onClick={() => handleCopyMessage(msg.content, index)} style={styles.copyButton}>
                    {copiedIndex === index ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              )}
              
              {msg.role === 'user' && (
                <button onClick={() => handleCopyMessage(msg.content, index)} style={styles.copyButtonSmall}>
                  {copiedIndex === index ? '✓' : '📋'}
                </button>
              )}
            </div>
          ))}

          {loading && <div style={styles.loadingMessage}>🤖 Analyzing entire subject content...</div>}
          <div ref={messagesEndRef} />
        </div>

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
            style={{ ...styles.sendButton, ...(loading || !question.trim() ? styles.sendButtonDisabled : {}) }}
          >
            {loading ? '⏳' : '🚀'} Ask
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', padding: '20px', backgroundColor: '#f5f5f5' },
  content: { maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' },
  header: { marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backLink: { display: 'inline-block', padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '14px' },
  clearButton: { padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' },
  titleCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' },
  subtitle: { fontSize: '16px', color: '#333', fontWeight: '600' },
  modeInfo: { fontSize: '14px', color: '#0066cc', marginTop: '5px' },
  statusBadge: { marginTop: '8px', fontSize: '12px', color: '#28a745', backgroundColor: '#e8f5e9', padding: '4px 10px', borderRadius: '12px', display: 'inline-block' },
  infoBanner: { backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '15px', color: '#856404', fontSize: '14px' },
  messagesContainer: { flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '15px', overflowY: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  emptyState: { textAlign: 'center', padding: '40px 20px', color: '#666' },
  hint: { marginTop: '20px', fontWeight: '600' },
  exampleList: { textAlign: 'left', display: 'inline-block', marginTop: '10px', color: '#555' },
  tableTip: { marginTop: '20px', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '8px', fontSize: '14px' },
  message: { marginBottom: '20px', padding: '15px', borderRadius: '8px', position: 'relative' },
  userMessage: { backgroundColor: '#e3f2fd', marginLeft: '60px' },
  aiMessage: { backgroundColor: '#f5f5f5', marginRight: '60px' },
  messageHeader: { marginBottom: '8px' },
  messageRole: { fontWeight: '600', fontSize: '14px', color: '#333' },
  messageContent: { lineHeight: '1.6', fontSize: '15px' },
  messageActions: { marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px' },
  likeButton: { padding: '6px 14px', backgroundColor: 'white', border: '1px solid #28a745', color: '#28a745', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  likedButton: { backgroundColor: '#28a745', color: 'white', cursor: 'default' },
  justLiked: { transform: 'scale(1.1)' },
  copyButton: { padding: '6px 14px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', color: '#666' },
  copyButtonSmall: { position: 'absolute', bottom: '10px', right: '10px', padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#666' },
  loadingMessage: { textAlign: 'center', padding: '20px', color: '#666' },
  inputArea: { backgroundColor: 'white', padding: '15px', borderRadius: '8px', display: 'flex', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  textarea: { flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', resize: 'none', fontFamily: 'inherit' },
  sendButton: { padding: '12px 24px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' },
  sendButtonDisabled: { backgroundColor: '#ccc', cursor: 'not-allowed' },
};