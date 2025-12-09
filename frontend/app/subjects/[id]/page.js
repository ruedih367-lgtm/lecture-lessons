//frontend/app/subjects/[id]/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getApiUrl } from '../../context/AuthContext';

const API_URL = getApiUrl();

export default function SubjectDetailPage() {
  const params = useParams();
  const subjectId = params.id;

  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [deletingTopicId, setDeletingTopicId] = useState(null);

  useEffect(() => {
    if (subjectId) {
      fetchSubject();
      fetchTopics();
    }
  }, [subjectId]);

  const fetchSubject = async () => {
    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}`);
      const data = await response.json();
      setSubject(data);
    } catch (err) {
      console.error('Error fetching subject:', err);
    }
  };

  const fetchTopics = async () => {
    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}/topics`);
      const data = await response.json();
      setTopics(data);
    } catch (err) {
      console.error('Error fetching topics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) return;

    const formData = new FormData();
    formData.append('name', newTopicName);
    formData.append('description', newTopicDesc);

    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}/topics`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        fetchTopics();
        setNewTopicName('');
        setNewTopicDesc('');
        setShowCreateTopic(false);
      }
    } catch (err) {
      alert('Failed to create topic');
    }
  };

  // DELETE TOPIC FUNCTION
  const handleDeleteTopic = async (e, topic) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmMsg = `⚠️ DELETE TOPIC?\n\nThis will permanently delete:\n• "${topic.name}"\n• ${topic.lecture_count || 0} lectures\n• All materials in those lectures\n\nThis cannot be undone!`;
    
    if (!confirm(confirmMsg)) return;

    setDeletingTopicId(topic.id);

    try {
      const response = await fetch(`${API_URL}/topics/${topic.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete topic');
      }

      const data = await response.json();
      alert(`✅ Deleted "${topic.name}" with ${data.deleted_lectures} lectures`);
      fetchTopics();
      
    } catch (err) {
      alert(`❌ Delete failed: ${err.message}`);
    } finally {
      setDeletingTopicId(null);
    }
  };

  const handleGenerateSubjectQuiz = async () => {
    if (!confirm('Generate a comprehensive quiz covering ALL lectures in this subject?')) {
      return;
    }

    setGeneratingQuiz(true);
    setQuiz(null);

    const formData = new FormData();
    formData.append('num_questions', '30');

    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}/quiz`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Quiz generation failed');

      const data = await response.json();
      setQuiz(data.quiz);
    } catch (err) {
      alert(`Failed to generate quiz: ${err.message}`);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <Link href="/subjects" style={styles.backLink}>
            ← All Subjects
          </Link>
        </div>

        <div style={styles.titleCard}>
          <h1 style={styles.title}>📁 {subject?.name || 'Loading...'}</h1>
          {subject?.description && (
            <p style={styles.subjectDescription}>{subject.description}</p>
          )}
          <div style={styles.actions}>
            <Link
              href={`/subjects/${subjectId}/study`}
              style={{
                ...styles.studyButton,
                ...(topics.length === 0 ? styles.buttonDisabled : {})
              }}
            >
              🤖 AI Study Assistant
            </Link>
            <button
              onClick={() => setShowCreateTopic(!showCreateTopic)}
              style={styles.createButton}
            >
              ➕ Create Topic
            </button>
            <button
              onClick={handleGenerateSubjectQuiz}
              disabled={generatingQuiz || topics.length === 0}
              style={{
                ...styles.quizButton,
                ...(generatingQuiz || topics.length === 0 ? styles.buttonDisabled : {})
              }}
            >
              {generatingQuiz ? '⏳ Generating...' : '📋 Quiz on Entire Subject'}
            </button>
          </div>
        </div>

        {showCreateTopic && (
          <div style={styles.createForm}>
            <input
              type="text"
              placeholder="Topic name (e.g., Cell Biology)"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              style={styles.input}
            />
            <textarea
              placeholder="Description (optional)"
              value={newTopicDesc}
              onChange={(e) => setNewTopicDesc(e.target.value)}
              style={styles.textarea}
              rows={2}
            />
            <div style={styles.formActions}>
              <button onClick={handleCreateTopic} style={styles.saveButton}>
                💾 Create
              </button>
              <button
                onClick={() => setShowCreateTopic(false)}
                style={styles.cancelButton}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {quiz && (
          <div style={styles.quizCard}>
            <div style={styles.quizHeader}>
              <h2 style={styles.quizTitle}>📋 Comprehensive Subject Quiz</h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(quiz);
                  alert('Quiz copied to clipboard!');
                }}
                style={styles.copyButton}
              >
                📋 Copy Quiz
              </button>
            </div>
            <pre style={styles.quizContent}>{quiz}</pre>
          </div>
        )}

        {loading && <p style={styles.loading}>Loading topics...</p>}

        {!loading && topics.length === 0 && (
          <div style={styles.empty}>
            <p>No topics yet. Create your first topic to organize lectures!</p>
          </div>
        )}

        <div style={styles.topicsGrid}>
          {topics.map((topic) => (
            <div key={topic.id} style={styles.topicCardWrapper}>
              <Link
                href={`/topics/${topic.id}`}
                style={styles.topicCard}
              >
                <div style={styles.topicIcon}>📂</div>
                <h3 style={styles.topicName}>{topic.name}</h3>
                {topic.description && (
                  <p style={styles.topicDesc}>{topic.description}</p>
                )}
                <div style={styles.topicStats}>
                  <span>📚 {topic.lecture_count || 0} lectures</span>
                </div>
              </Link>

              {/* DELETE TOPIC BUTTON */}
              <button
                onClick={(e) => handleDeleteTopic(e, topic)}
                disabled={deletingTopicId === topic.id}
                style={{
                  ...styles.deleteButton,
                  ...(deletingTopicId === topic.id ? styles.deleteButtonDisabled : {})
                }}
              >
                {deletingTopicId === topic.id ? '⏳' : '🗑️'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 20px',
    backgroundColor: '#f5f5f5',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '20px',
  },
  backLink: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  titleCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  subjectDescription: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  studyButton: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#17a2b8',
    color: 'white',
    textDecoration: 'none',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  quizButton: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  createForm: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '10px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '10px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  quizCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  quizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  quizTitle: {
    fontSize: '20px',
    fontWeight: '600',
  },
  copyButton: {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  quizContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    fontSize: '14px',
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '600px',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    fontSize: '18px',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
  },
  topicsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  topicCardWrapper: {
    position: 'relative',
  },
  topicCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    display: 'block',
  },
  topicIcon: {
    fontSize: '48px',
    marginBottom: '15px',
  },
  topicName: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#333',
    paddingRight: '40px',
  },
  topicDesc: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px',
  },
  topicStats: {
    fontSize: '14px',
    color: '#666',
    borderTop: '1px solid #eee',
    paddingTop: '15px',
  },
  deleteButton: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    width: '36px',
    height: '36px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
};