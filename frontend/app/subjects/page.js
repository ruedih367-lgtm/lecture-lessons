// frontend/app/subjects/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getApiUrl } from '../context/AuthContext';

const API_URL = getApiUrl();

export default function SubjectsPage() {
  const router = useRouter();
  const { user, isAuthenticated, currentClass, authFetch, selectClass } = useAuth();
  
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectDesc, setNewSubjectDesc] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (isAuthenticated && !currentClass) {
      // Redirect to classes if no class selected
      router.push('/classes');
      return;
    }
    fetchSubjects();
  }, [isAuthenticated, currentClass]);

  const fetchSubjects = async () => {
    try {
      let url = `${API_URL}/subjects`;
      if (currentClass) {
        url = `${API_URL}/classes/${currentClass.id}/subjects`;
      }
      
      const response = await authFetch(url);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;

    const formData = new FormData();
    formData.append('name', newSubjectName);
    formData.append('description', newSubjectDesc);

    try {
      let url = `${API_URL}/subjects`;
      if (currentClass) {
        url = `${API_URL}/classes/${currentClass.id}/subjects`;
      }
      
      const response = await authFetch(url, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        fetchSubjects();
        setNewSubjectName('');
        setNewSubjectDesc('');
        setShowCreateSubject(false);
      }
    } catch (err) {
      alert('Failed to create subject');
    }
  };

  const handleDeleteSubject = async (e, subject) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmMsg = `⚠️ DELETE ENTIRE SUBJECT?\n\nThis will permanently delete:\n• "${subject.name}"\n• ${subject.topic_count || 0} topics\n• ALL lectures in those topics\n• ALL materials\n\nThis cannot be undone!`;
    
    if (!confirm(confirmMsg)) return;

    setDeletingId(subject.id);

    try {
      const response = await authFetch(`${API_URL}/subjects/${subject.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Deleted "${subject.name}" with ${data.deleted_topics} topics and ${data.deleted_lectures} lectures`);
        fetchSubjects();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      alert(`❌ Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Class Header */}
        {currentClass && (
          <div style={styles.classHeader}>
            <div>
              <Link href="/classes" style={styles.backToClasses}>
                ← All Classes
              </Link>
              <h2 style={styles.className}>📚 {currentClass.name}</h2>
            </div>
            {user && (
              <span style={styles.userInfo}>
                👤 {user.name || user.email}
              </span>
            )}
          </div>
        )}

        <div style={styles.header}>
          <h1 style={styles.title}>📁 Subjects</h1>
          <div style={styles.headerActions}>
            <Link href="/lectures" style={styles.viewAllLink}>
              📚 All Lectures
            </Link>
            <Link href="/" style={styles.uploadLink}>
              🚀 Upload Lecture
            </Link>
          </div>
        </div>

        <button
          onClick={() => setShowCreateSubject(!showCreateSubject)}
          style={styles.createButton}
        >
          ➕ Create New Subject
        </button>

        {showCreateSubject && (
          <div style={styles.createForm}>
            <input
              type="text"
              placeholder="Subject name (e.g., Biology 101)"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              style={styles.input}
            />
            <textarea
              placeholder="Description (optional)"
              value={newSubjectDesc}
              onChange={(e) => setNewSubjectDesc(e.target.value)}
              style={styles.textarea}
              rows={2}
            />
            <div style={styles.formActions}>
              <button onClick={handleCreateSubject} style={styles.saveButton}>
                💾 Create
              </button>
              <button
                onClick={() => setShowCreateSubject(false)}
                style={styles.cancelButton}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p style={styles.loading}>Loading subjects...</p>}

        {!loading && subjects.length === 0 && (
          <div style={styles.empty}>
            <p>No subjects yet. Create your first one!</p>
          </div>
        )}

        <div style={styles.subjectsGrid}>
          {subjects.map((subject) => (
            <div key={subject.id} style={styles.subjectCardWrapper}>
              <Link
                href={`/subjects/${subject.id}`}
                style={styles.subjectCard}
              >
                <div style={styles.subjectIcon}>📁</div>
                <h3 style={styles.subjectName}>{subject.name}</h3>
                {subject.description && (
                  <p style={styles.subjectDesc}>{subject.description}</p>
                )}
                <div style={styles.subjectStats}>
                  <span>📂 {subject.topic_count || 0} topics</span>
                </div>
              </Link>
              
              <button
                onClick={(e) => handleDeleteSubject(e, subject)}
                disabled={deletingId === subject.id}
                style={{
                  ...styles.deleteButton,
                  ...(deletingId === subject.id ? styles.deleteButtonDisabled : {})
                }}
              >
                {deletingId === subject.id ? '⏳' : '🗑️'}
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
  classHeader: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backToClasses: {
    color: '#0066cc',
    textDecoration: 'none',
    fontSize: '14px',
  },
  className: {
    fontSize: '24px',
    fontWeight: '600',
    marginTop: '5px',
  },
  userInfo: {
    color: '#666',
    fontSize: '14px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  viewAllLink: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  uploadLink: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '20px',
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
  subjectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  subjectCardWrapper: {
    position: 'relative',
  },
  subjectCard: {
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
  subjectIcon: {
    fontSize: '48px',
    marginBottom: '15px',
  },
  subjectName: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#333',
    paddingRight: '40px',
  },
  subjectDesc: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px',
  },
  subjectStats: {
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