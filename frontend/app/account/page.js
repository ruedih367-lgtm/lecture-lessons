// frontend/app/account/page.js

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, getApiUrl } from '../context/AuthContext';

const API_URL = getApiUrl();

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, authFetch, logout } = useAuth();

  const [learningStatus, setLearningStatus] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchLearningStatus();
  }, [isAuthenticated]);

  const fetchLearningStatus = async () => {
    try {
      const response = await authFetch(`${API_URL}/learning/status`);
      if (response.ok) {
        const data = await response.json();
        setLearningStatus(data);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleResetLearning = async () => {
    const confirmed = confirm(
      '⚠️ Reset AI Learning?\n\n' +
      'This will erase all learned preferences. ' +
      'The AI will start fresh and you\'ll need to like responses again to train it.\n\n' +
      'Are you sure?'
    );

    if (!confirmed) return;

    setResetting(true);

    try {
      const response = await authFetch(`${API_URL}/learning/reset`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('✅ Learning reset! The AI will start fresh.');
        fetchLearningStatus();
      } else {
        alert('Failed to reset');
      }
    } catch (err) {
      alert('Error resetting');
    } finally {
      setResetting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <Link href="/classes" style={styles.backLink}>
            ← Back to Classes
          </Link>
        </div>

        {/* Account Info */}
        <div style={styles.card}>
          <h1 style={styles.title}>👤 Account</h1>
          
          <div style={styles.infoRow}>
            <span style={styles.label}>Email</span>
            <span style={styles.value}>{user?.email}</span>
          </div>
          
          {user?.name && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Name</span>
              <span style={styles.value}>{user.name}</span>
            </div>
          )}
        </div>

        {/* Learning Status */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>🧠 AI Personalization</h2>
          
          {learningStatus && (
            <div style={styles.statusBox}>
              <div style={styles.statusIcon}>
                {learningStatus.status === 'active' ? '✨' : 
                 learningStatus.status === 'learning' ? '🧠' : '💤'}
              </div>
              <div style={styles.statusText}>
                <p style={styles.statusMessage}>{learningStatus.message}</p>
                <p style={styles.statusDetail}>
                  Total likes: {learningStatus.total_likes}
                </p>
              </div>
            </div>
          )}

          <div style={styles.howItWorks}>
            <h3 style={styles.howTitle}>How it works</h3>
            <ul style={styles.howList}>
              <li>👍 Like helpful AI responses while studying</li>
              <li>🧠 After 5 likes, the AI learns your preferences</li>
              <li>✨ Future explanations adapt to your style</li>
            </ul>
          </div>
        </div>

        {/* Logout */}
        <div style={styles.card}>
          <button onClick={logout} style={styles.logoutButton}>
            🚪 Log Out
          </button>
        </div>

        {/* Advanced Section - Hidden by default */}
        <div style={styles.advancedSection}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={styles.advancedToggle}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>
          
          {showAdvanced && (
            <div style={styles.advancedContent}>
              <div style={styles.warningBox}>
                <h3 style={styles.warningTitle}>⚠️ Danger Zone</h3>
                <p style={styles.warningText}>
                  If the AI's personalization isn't working well for you, 
                  you can reset it and start fresh.
                </p>
                
                <button
                  onClick={handleResetLearning}
                  disabled={resetting}
                  style={styles.resetButton}
                >
                  {resetting ? '⏳ Resetting...' : '🔄 Reset AI Learning'}
                </button>
              </div>
            </div>
          )}
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
    maxWidth: '600px',
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
  card: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #eee',
  },
  label: {
    color: '#666',
    fontSize: '14px',
  },
  value: {
    fontWeight: '500',
    fontSize: '14px',
  },
  statusBox: {
    display: 'flex',
    gap: '15px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  statusIcon: {
    fontSize: '32px',
  },
  statusText: {
    flex: 1,
  },
  statusMessage: {
    fontWeight: '600',
    marginBottom: '5px',
    fontSize: '14px',
  },
  statusDetail: {
    color: '#666',
    fontSize: '13px',
    margin: 0,
  },
  howItWorks: {
    backgroundColor: '#e3f2fd',
    padding: '15px',
    borderRadius: '8px',
  },
  howTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#1565c0',
  },
  howList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#1565c0',
    lineHeight: '1.8',
  },
  logoutButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  advancedSection: {
    marginTop: '30px',
  },
  advancedToggle: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '5px 0',
  },
  advancedContent: {
    marginTop: '15px',
  },
  warningBox: {
    backgroundColor: '#fff8e1',
    border: '1px solid #ffcc80',
    padding: '20px',
    borderRadius: '8px',
  },
  warningTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e65100',
    marginBottom: '10px',
  },
  warningText: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '15px',
    lineHeight: '1.6',
  },
  resetButton: {
    padding: '10px 20px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
};