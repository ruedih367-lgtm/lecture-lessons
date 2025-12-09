// frontend/app/classes/page.js

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, getApiUrl } from '../context/AuthContext';

const API_URL = getApiUrl();

export default function ClassesPage() {
  const router = useRouter();
  const { user, isAuthenticated, authFetch, selectClass, currentClass, logout } = useAuth();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showJoinClass, setShowJoinClass] = useState(false);
  
  // Create class form
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Join class form
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchClasses();
  }, [isAuthenticated]);

  const fetchClasses = async () => {
    try {
      const response = await authFetch(`${API_URL}/classes`);
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', newClassName);
      formData.append('description', newClassDesc);

      const response = await authFetch(`${API_URL}/classes`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to create class');
      }

      const data = await response.json();
      setSuccess(`Class created! Share this code with students: ${data.class_code}`);
      setShowCreateClass(false);
      setNewClassName('');
      setNewClassDesc('');
      fetchClasses();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setJoining(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('class_code', joinCode);
      formData.append('display_name', displayName);

      const response = await authFetch(`${API_URL}/classes/join`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to join class');
      }

      const data = await response.json();
      setSuccess(data.message);
      setShowJoinClass(false);
      setJoinCode('');
      setDisplayName('');
      fetchClasses();
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleSelectClass = (classData) => {
    selectClass(classData);
    router.push('/subjects');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>📚 My Classes</h1>
            <p style={styles.subtitle}>Welcome, {user?.name || user?.email}</p>
          </div>
          <div style={styles.headerButtons}>
            <Link href="/account" style={styles.accountButton}>
              👤 Account
            </Link>
            <button onClick={logout} style={styles.logoutButton}>
              🚪 Log Out
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && <div style={styles.error}>❌ {error}</div>}
        {success && (
          <div style={styles.success}>
            ✅ {success}
            <button onClick={() => setSuccess('')} style={styles.dismissButton}>×</button>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button
            onClick={() => { setShowCreateClass(true); setShowJoinClass(false); }}
            style={styles.createButton}
          >
            ➕ Create New Class
          </button>
          <button
            onClick={() => { setShowJoinClass(true); setShowCreateClass(false); }}
            style={styles.joinButton}
          >
            🔑 Join Class with Code
          </button>
        </div>

        {/* Create Class Form */}
        {showCreateClass && (
          <div style={styles.formCard}>
            <h2 style={styles.formTitle}>Create a New Class</h2>
            <p style={styles.formSubtitle}>You'll be the teacher and can share the code with students</p>
            
            <form onSubmit={handleCreateClass} style={styles.form}>
              <input
                type="text"
                placeholder="Class name (e.g., Biology 101 - Fall 2024)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                style={styles.input}
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={newClassDesc}
                onChange={(e) => setNewClassDesc(e.target.value)}
                style={styles.textarea}
                rows={2}
              />
              <div style={styles.formButtons}>
                <button type="submit" disabled={creating} style={styles.submitButton}>
                  {creating ? '⏳ Creating...' : '✨ Create Class'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Class Form */}
        {showJoinClass && (
          <div style={styles.formCard}>
            <h2 style={styles.formTitle}>Join a Class</h2>
            <p style={styles.formSubtitle}>Enter the 6-character code from your teacher</p>
            
            <form onSubmit={handleJoinClass} style={styles.form}>
              <input
                type="text"
                placeholder="Class code (e.g., ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                style={{...styles.input, ...styles.codeInput}}
                maxLength={6}
                required
              />
              <input
                type="text"
                placeholder="Your display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={styles.input}
              />
              <div style={styles.formButtons}>
                <button type="submit" disabled={joining} style={styles.submitButton}>
                  {joining ? '⏳ Joining...' : '🚀 Join Class'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinClass(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Classes List */}
        {loading && <p style={styles.loading}>Loading your classes...</p>}

        {!loading && classes.length === 0 && (
          <div style={styles.emptyState}>
            <h2>🎒 No classes yet!</h2>
            <p>Create a new class to start teaching, or join an existing class with a code.</p>
          </div>
        )}

        <div style={styles.classGrid}>
          {classes.map((cls) => (
            <div
              key={cls.id}
              style={{
                ...styles.classCard,
                ...(currentClass?.id === cls.id ? styles.selectedClass : {})
              }}
            >
              <div style={styles.classHeader}>
                <span style={styles.roleTag}>
                  {cls.role === 'teacher' ? '👨‍🏫 Teacher' : '👨‍🎓 Student'}
                </span>
                {currentClass?.id === cls.id && (
                  <span style={styles.activeTag}>✓ Active</span>
                )}
              </div>
              
              <h3 style={styles.className}>{cls.name}</h3>
              
              {cls.description && (
                <p style={styles.classDesc}>{cls.description}</p>
              )}
              
              <div style={styles.classStats}>
                <span>📁 {cls.subject_count || 0} subjects</span>
                {cls.role === 'teacher' && (
                  <span style={styles.classCode}>Code: {cls.class_code}</span>
                )}
              </div>
              
              <button
                onClick={() => handleSelectClass(cls)}
                style={styles.enterButton}
              >
                {currentClass?.id === cls.id ? '📂 Open Class' : '➡️ Enter Class'}
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  subtitle: {
    color: '#666',
    fontSize: '14px',
  },
  headerButtons: {
    display: 'flex',
    gap: '10px',
  },
  accountButton: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  logoutButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  success: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#2e7d32',
  },
  actions: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
  },
  createButton: {
    padding: '15px 30px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
  },
  joinButton: {
    padding: '15px 30px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '5px',
  },
  formSubtitle: {
    color: '#666',
    fontSize: '14px',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
  },
  codeInput: {
    textTransform: 'uppercase',
    letterSpacing: '4px',
    fontSize: '20px',
    textAlign: 'center',
    maxWidth: '200px',
  },
  textarea: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  formButtons: {
    display: 'flex',
    gap: '10px',
  },
  submitButton: {
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  cancelButton: {
    padding: '12px 24px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    padding: '40px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    color: '#666',
  },
  classGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  classCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '2px solid transparent',
  },
  selectedClass: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },
  classHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  roleTag: {
    fontSize: '12px',
    color: '#666',
    backgroundColor: '#f0f0f0',
    padding: '4px 8px',
    borderRadius: '12px',
  },
  activeTag: {
    fontSize: '12px',
    color: '#28a745',
    backgroundColor: '#e8f5e9',
    padding: '4px 8px',
    borderRadius: '12px',
    fontWeight: '600',
  },
  className: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#333',
  },
  classDesc: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px',
  },
  classStats: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px',
    paddingTop: '15px',
    borderTop: '1px solid #eee',
  },
  classCode: {
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  enterButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
};