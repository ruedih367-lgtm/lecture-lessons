//frontend/app/lectures/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from '../context/AuthContext';

const API_URL = getApiUrl();

export default function LecturesPage() {
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLectures();
  }, []);

  const fetchLectures = async () => {
    try {
      const response = await fetch(`${API_URL}/lectures`);
      if (!response.ok) throw new Error('Failed to fetch lectures');
      
      const data = await response.json();
      setLectures(data);
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

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>📚 All Lectures</h1>
          <Link href="/" style={styles.backLink}>
            ← Back to Upload
          </Link>
        </div>

        {loading && (
          <p style={styles.loading}>Loading lectures...</p>
        )}

        {error && (
          <div style={styles.error}>❌ {error}</div>
        )}

        {!loading && !error && lectures.length === 0 && (
          <div style={styles.empty}>
            <p>No lectures yet. Upload your first one!</p>
            <Link href="/" style={styles.uploadLink}>
              🚀 Upload Lecture
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
                  ⏱️ {formatDuration(lecture.audio_duration_seconds)}
                </span>
                <span style={styles.infoItem}>
                  📅 {formatDate(lecture.created_at)}
                </span>
              </div>

              <div style={styles.viewButton}>
                View Transcript →
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
    alignItems: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
  },
  backLink: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
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
  uploadLink: {
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