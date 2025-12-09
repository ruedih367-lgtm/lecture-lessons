// frontend/app/lectures/[id]/study/page.js

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth, getApiUrl } from '../../../context/AuthContext';

const API_URL = getApiUrl();

export default function StudyPage() {
  const params = useParams();
  const lectureId = params.id;
  const messagesEndRef = useRef(null);
  const { user, authFetch, isAuthenticated } = useAuth();

  const [lecture, setLecture] = useState(null);
  const [mode, setMode] = useState('tutor');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [likedIndex, setLikedIndex] = useState(null);
  const [learningStatus, setLearningStatus] = useState(null);

  useEffect(() => {
    fetchLecture();
    if (isAuthenticated) {
      fetchLearningStatus();
    }
  }, [lectureId, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchLecture = async () => {
    try {
      const response = await fetch(`${API_URL}/lectures/${lectureId}`);
      const data = await response.json();
      setLecture(data);
    } catch (err) {
      console.error('Error fetching lecture:', err);
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

    const userMessage = {
      role: 'user',
      content: question,
      mode: mode
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    const formData = new FormData();
    formData.append('question', question);
    formData.append('mode', mode);
    formData.append('chat_history', JSON.stringify(messages));

    try {
      const response = await authFetch(`${API_URL}/lectures/${lectureId}/ask`, {
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
        mode: mode,
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
      formData.append('mode', msg.mode || 'tutor');

      const response = await authFetch(`${API_URL}/responses/like`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Mark as liked
        const updatedMessages = [...messages];
        updatedMessages[index] = { ...msg, liked: true };
        setMessages(updatedMessages);
        
        setLikedIndex(index);
        setTimeout(() => setLikedIndex(null), 2000);

        // Refresh learning status
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

  const getModeEmoji = (modeType) => {
    switch (modeType) {
      case 'tutor': return '💬';
      case 'practice': return '📝';
      case 'exam': return '📋';
      default: return '💬';
    }
  };

  const getPlaceholder = () => {
    switch (mode) {
      case 'tutor':
        return 'Ask a question... (e.g., "Explain mitosis in simple terms")';
      case 'practice':
        return 'Request practice problems... (e.g., "Generate 5 problems on cell division")';
      case 'exam':
        return 'Request a mock exam... (e.g., "Create a 20-question exam")';
      default:
        return 'Ask a question...';
    }
  };

  const getLearningStatusBadge = () => {
    if (!learningStatus) return null;
    
    if (learningStatus.status === 'active') {
      return (
        <div style={styles.statusBadge}>
          ✨ AI personalized ({learningStatus.total_likes} likes)
        </div>
      );
    } else if (learningStatus.status === 'learning') {
      return (
        <div style={styles.statusBadgeLearning}>
          🧠 {learningStatus.message}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <Link href={`/lectures/${lectureId}`} style={styles.backLink}>
            ← Back to Lecture
          </Link>
          <div style={styles.headerRight}>
            {messages.length > 0 && (
              <button onClick={handleClearChat} style={styles.clearButton}>
                🗑️ Clear
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={styles.titleCard}>
          <h1 style={styles.title}>🤖 AI Study Assistant</h1>
          {lecture && <p style={styles.subtitle}>{lecture.title}</p>}
          {isAuthenticated && getLearningStatusBadge()}
          {!isAuthenticated && (
            <p style={styles.loginHint}>
              <Link href="/login" style={styles.loginLink}>Log in</Link> to get personalized explanations
            </p>
          )}
        </div>

        {/* Mode Selector */}
        <div style={styles.modeSelector}>
          <button
            onClick={() => setMode('tutor')}
            style={{
              ...styles.modeButton,
              ...(mode === 'tutor' && styles.modeButtonActive)
            }}
          >
            💬 Tutor
          </button>
          
          <button
            onClick={() => setMode('practice')}
            style={{
              ...styles.modeButton,
              ...(mode === 'practice' && styles.modeButtonActive)
            }}
          >
            📝 Practice
          </button>
          
          <button
            onClick={() => setMode('exam')}
            style={{
              ...styles.modeButton,
              ...(mode === 'exam' && styles.modeButtonActive)
            }}
          >
            📋 Exam
          </button>
        </div>

        {/* Messages */}
        <div style={styles.messagesContainer}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <h3>👋 Start studying!</h3>
              <p>Ask questions, generate practice problems, or create mock exams.</p>
              {isAuthenticated && (
                <p style={styles.likeHint}>
                  👍 <strong>Like</strong> helpful responses to train the AI to your learning style!
                </p>
              )}
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
                <span style={styles.messageRole}>
                  {msg.role === 'user' ? `You (${getModeEmoji(msg.mode)})` : '🤖 AI Tutor'}
                </span>
              </div>
              
              <div style={styles.messageContent}>
                {msg.content}
              </div>
              
              {/* Action buttons for AI messages */}
              {msg.role === 'assistant' && (
                <div style={styles.messageActions}>
                  {/* Like button */}
                  <button
                    onClick={() => handleLikeResponse(index)}
                    disabled={msg.liked}
                    style={{
                      ...styles.likeButton,
                      ...(msg.liked ? styles.likedButton : {}),
                      ...(likedIndex === index ? styles.justLiked : {})
                    }}
                    title={msg.liked ? 'Liked!' : 'This explanation helped me'}
                  >
                    {msg.liked ? '✓ Liked' : '👍 Helpful'}
                  </button>
                  
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopyMessage(msg.content, index)}
                    style={styles.copyButton}
                  >
                    {copiedIndex === index ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
              )}
              
              {/* Copy for user messages */}
              {msg.role === 'user' && (
                <button
                  onClick={() => handleCopyMessage(msg.content, index)}
                  style={styles.copyButtonSmall}
                >
                  {copiedIndex === index ? '✓' : '📋'}
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div style={styles.loadingMessage}>
              🤖 Thinking...
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
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
            placeholder={getPlaceholder()}
            style={styles.textarea}
            rows={2}
          />
          
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            style={{
              ...styles.sendButton,
              ...(loading || !question.trim() ? styles.sendButtonDisabled : {})
            }}
          >
            {loading ? '⏳' : '🚀'}
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
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    display: 'flex',
    gap: '10px',
  },
  backLink: {
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
    padding: '15px 20px',
    borderRadius: '8px',
    marginBottom: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  statusBadge: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#28a745',
    backgroundColor: '#e8f5e9',
    padding: '4px 10px',
    borderRadius: '12px',
    display: 'inline-block',
  },
  statusBadgeLearning: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#ff9800',
    backgroundColor: '#fff3e0',
    padding: '4px 10px',
    borderRadius: '12px',
    display: 'inline-block',
  },
  loginHint: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
  },
  loginLink: {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  modeSelector: {
    display: 'flex',
    gap: '10px',
    marginBottom: '10px',
  },
  modeButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'white',
    border: '2px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  modeButtonActive: {
    backgroundColor: '#0066cc',
    color: 'white',
    borderColor: '#0066cc',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '10px',
    overflowY: 'auto',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#666',
  },
  likeHint: {
    marginTop: '15px',
    padding: '10px 15px',
    backgroundColor: '#e3f2fd',
    borderRadius: '8px',
    fontSize: '14px',
  },
  message: {
    marginBottom: '15px',
    padding: '15px',
    borderRadius: '8px',
    position: 'relative',
  },
  userMessage: {
    backgroundColor: '#e3f2fd',
    marginLeft: '40px',
  },
  aiMessage: {
    backgroundColor: '#f5f5f5',
    marginRight: '40px',
  },
  messageHeader: {
    marginBottom: '8px',
  },
  messageRole: {
    fontWeight: '600',
    fontSize: '13px',
    color: '#333',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    fontSize: '14px',
  },
  messageActions: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    gap: '8px',
  },
  likeButton: {
    padding: '6px 14px',
    backgroundColor: 'white',
    border: '1px solid #28a745',
    color: '#28a745',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  likedButton: {
    backgroundColor: '#28a745',
    color: 'white',
    cursor: 'default',
  },
  justLiked: {
    transform: 'scale(1.1)',
  },
  copyButton: {
    padding: '6px 14px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
  },
  copyButtonSmall: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#666',
  },
  loadingMessage: {
    textAlign: 'center',
    padding: '20px',
    color: '#666',
  },
  inputArea: {
    backgroundColor: 'white',
    padding: '12px',
    borderRadius: '8px',
    display: 'flex',
    gap: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  textarea: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'none',
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
};