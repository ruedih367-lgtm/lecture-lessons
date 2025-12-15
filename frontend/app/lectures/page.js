//frontend/app/lectures/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getApiUrl } from '../context/AuthContext';

const API_URL = getApiUrl();

export default function LecturesPage() {
  const router = useRouter();
  const { isAuthenticated, currentClass, authFetch } = useAuth();
  
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Require authentication
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    // Require class selection
    if (!currentClass) {
      router.push('/classes');
      return;
    }
    
    fetchLectures();
  }, [isAuthenticated, currentClass]);

  const fetchLectures = async () => {
    if (!currentClass) return;
    
    try {
      const response = await authFetch(`${API_URL}/classes/${currentClass.id}/lectures`);
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      if (!response.ok) throw new Error('Failed to fetch lectures');
      
      const data = await response.json();
      setLectures(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show nothing while checking auth
  if (!isAuthenticated || !currentClass) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Lectures</h1>
            <p style={styles.subtitle}>Class: {currentClass.name}</p>
          </div>
          <div style={styles.headerActions}>
            <Link href="/subjects" style={styles.backLink}>
              Back to Subjects
            </Link>
            <Link href="/" style={styles.uploadLink}>
              Upload Lecture
            </Link>
          </div>
        </div>

        {loading && (
          <p style={styles.loading}>Loading lectures...</p>
        )}

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {!loading && !error && lectures.length === 0 && (
          <div style={styles.empty}>
            <p>No lectures in this class yet.</p>
            <p style={styles.emptyHint}>Upload a lecture and assign it to a topic in this class.</p>
            <Link href="/" style={styles.uploadLinkLarge}>
              Upload Lecture
            </Link>
          </div>
        )}

        <div style={styles.lectureGrid}>
          {lectures.map((lecture) => (
            <Link
              key={lecture.id}
              href={`/lectures/${lecture.id}`}
              style={styles.lectureCard}
            >
              <h3 style={styles.lectureTitle}>{lecture.title}</h3>
              
              <div style={styles.lectureInfo}>
                <span style={styles.infoItem}>
                  Duration: {formatDuration(lecture.audio_duration_seconds)}
                </span>
                <span style={styles.infoItem}>
                  {formatDate(lecture.created_at)}
                </span>
              </div>

              <div style={styles.viewButton}>
                View Transcript
              </div>
            </Link>
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
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  backLink: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  uploadLink: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    fontSize: '18px',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '15px',
    borderRadius: '4px',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
  },
  emptyHint: {
    color: '#666',
    marginTop: '10px',
    marginBottom: '20px',
  },
  uploadLinkLarge: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '12px 24px',
    backgroundColor: '#0066cc',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '600',
  },
  lectureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  lectureCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    display: 'block',
  },
  lectureTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#333',
  },
  lectureInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '15px',
  },
  infoItem: {
    fontSize: '14px',
    color: '#666',
  },
  viewButton: {
    color: '#0066cc',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '10px',
  },
};