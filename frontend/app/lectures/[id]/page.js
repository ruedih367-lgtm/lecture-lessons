// frontend/app/lectures/[id]/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getApiUrl } from '../../context/AuthContext';
import PdfUploader from '../../components/PdfUploader';
import MarkdownRenderer from '../../components/MarkdownRenderer';

const API_URL = getApiUrl();

export default function LecturePage() {
  const params = useParams();
  const router = useRouter();
  const lectureId = params.id;

  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('cleaned');
  const [materials, setMaterials] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [showPdfUploader, setShowPdfUploader] = useState(false);

  useEffect(() => {
    if (lectureId) {
      fetchLecture();
      fetchMaterials();
    }
  }, [lectureId]);

  const fetchLecture = async () => {
    try {
      const response = await fetch(`${API_URL}/lectures/${lectureId}`);
      if (!response.ok) throw new Error('Lecture not found');
      const data = await response.json();
      setLecture(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch(`${API_URL}/lectures/${lectureId}/materials`);
      if (!response.ok) throw new Error('Failed to fetch materials');
      const data = await response.json();
      setMaterials(data);
    } catch (err) {
      console.error('Error fetching materials:', err);
    }
  };

  const handlePdfUploadComplete = (data) => {
    fetchMaterials();
    setShowPdfUploader(false);
  };

  const handleDeleteLecture = async () => {
    const confirmMsg = `DELETE LECTURE?\n\nThis will permanently delete:\n- "${lecture.title}"\n- All uploaded materials (${materials.length} files)\n\nThis cannot be undone!`;
    
    if (!confirm(confirmMsg)) return;

    setDeleting(true);

    try {
      const response = await fetch(`${API_URL}/lectures/${lectureId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete lecture');
      }

      alert('Lecture deleted successfully!');
      router.push('/lectures');
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
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

  const getDisplayedContent = () => {
    if (!lecture) return '';
    switch (viewMode) {
      case 'raw':
        return lecture.raw_transcript;
      case 'summary':
        return lecture.summary || 'No summary available for this lecture.';
      case 'cleaned':
      default:
        return lecture.cleaned_transcript;
    }
  };

  const getContentLabel = () => {
    switch (viewMode) {
      case 'raw':
        return 'Raw Transcript';
      case 'summary':
        return 'Summary';
      case 'cleaned':
      default:
        return 'Cleaned Transcript';
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <p style={styles.loading}>Loading lecture...</p>
        </div>
      </div>
    );
  }

  if (error || !lecture) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.error}>{error || 'Lecture not found'}</div>
          <Link href="/lectures" style={styles.backLink}>
            Back to Lectures
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <Link href="/lectures" style={styles.backLink}>
            All Lectures
          </Link>
        </div>

        <div style={styles.infoCard}>
          <h1 style={styles.title}>{lecture.title}</h1>
          
          <div style={styles.metadata}>
            <span style={styles.metaItem}>
              Duration: {formatDuration(lecture.audio_duration_seconds)}
            </span>
            <span style={styles.metaItem}>
              {formatDate(lecture.created_at)}
            </span>
            <span style={styles.metaItem}>
              {lecture.cleaned_transcript?.length || 0} characters
            </span>
            {lecture.summary && (
              <span style={styles.metaItem}>
                Summary available
              </span>
            )}
          </div>

          <div style={styles.actions}>
            <Link href={`/lectures/${lectureId}/study`} style={styles.studyButton}>
              AI Study Assistant
            </Link>
            
            <button
              onClick={() => {
                const text = getDisplayedContent();
                navigator.clipboard.writeText(text);
                alert(`${getContentLabel()} copied to clipboard!`);
              }}
              style={styles.actionButton}
            >
              Copy {getContentLabel()}
            </button>

            <button
              onClick={handleDeleteLecture}
              disabled={deleting}
              style={{
                ...styles.deleteButton,
                ...(deleting ? styles.deleteButtonDisabled : {})
              }}
            >
              {deleting ? 'Deleting...' : 'Delete Lecture'}
            </button>
          </div>
        </div>

        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode('cleaned')}
            style={{
              ...styles.toggleButton,
              ...(viewMode === 'cleaned' ? styles.toggleButtonActive : {})
            }}
          >
            Cleaned Transcript
          </button>
          <button
            onClick={() => setViewMode('summary')}
            style={{
              ...styles.toggleButton,
              ...(viewMode === 'summary' ? styles.toggleButtonActive : {}),
              ...(!lecture.summary ? styles.toggleButtonDisabled : {})
            }}
            disabled={!lecture.summary}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('raw')}
            style={{
              ...styles.toggleButton,
              ...(viewMode === 'raw' ? styles.toggleButtonActive : {})
            }}
          >
            Raw Transcript
          </button>
        </div>

        <div style={styles.materialsCard}>
          <div style={styles.materialsHeader}>
            <h2 style={styles.sectionTitle}>Course Materials</h2>
            <button
              onClick={() => setShowPdfUploader(!showPdfUploader)}
              style={styles.addPdfButton}
            >
              {showPdfUploader ? 'Cancel' : 'Add PDF'}
            </button>
          </div>
          
          {showPdfUploader && (
            <PdfUploader
              targetType="lecture"
              targetId={lectureId}
              onUploadComplete={handlePdfUploadComplete}
            />
          )}

          {materials.length > 0 && (
            <div style={styles.materialsList}>
              {materials.map((material) => (
                <div key={material.id} style={styles.materialItem}>
                  <div style={styles.materialInfo}>
                    <span style={styles.materialName}>{material.file_name}</span>
                    {material.page_count && material.total_pages && (
                      <span style={styles.pageInfo}>
                        {material.page_count} of {material.total_pages} pages
                      </span>
                    )}
                  </div>
                  <span style={styles.materialDate}>
                    {new Date(material.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {materials.length === 0 && !showPdfUploader && (
            <p style={styles.noMaterials}>No materials uploaded yet.</p>
          )}
        </div>

        <div style={styles.transcriptCard}>
          <h2 style={styles.transcriptTitle}>
            {getContentLabel()}
            {viewMode === 'summary' && lecture.summary && (
              <span style={styles.summaryBadge}>
                {lecture.summary?.length || 0} chars ({Math.round((lecture.summary?.length || 0) / (lecture.cleaned_transcript?.length || 1) * 100)}% of full)
              </span>
            )}
          </h2>
          
          <div style={styles.transcript}>
            <MarkdownRenderer content={getDisplayedContent()} />
          </div>
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
    maxWidth: '900px',
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
  loading: {
    textAlign: 'center',
    color: '#666',
    fontSize: '18px',
    marginTop: '100px',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  infoCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#333',
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    marginBottom: '20px',
  },
  metaItem: {
    fontSize: '14px',
    color: '#666',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  studyButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
  },
  actionButton: {
    padding: '12px 24px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  deleteButton: {
    padding: '12px 24px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  viewToggle: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  toggleButton: {
    padding: '10px 20px',
    backgroundColor: 'white',
    border: '2px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  toggleButtonActive: {
    backgroundColor: '#0066cc',
    color: 'white',
    borderColor: '#0066cc',
  },
  toggleButtonDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
    cursor: 'not-allowed',
  },
  materialsCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  materialsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
    margin: 0,
  },
  addPdfButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  materialsList: {
    marginTop: '20px',
  },
  materialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '10px',
  },
  materialInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  materialName: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  },
  pageInfo: {
    fontSize: '12px',
    color: '#28a745',
  },
  materialDate: {
    fontSize: '12px',
    color: '#666',
  },
  noMaterials: {
    color: '#666',
    fontStyle: 'italic',
    padding: '20px',
    textAlign: 'center',
  },
  transcriptCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  transcriptTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap',
  },
  summaryBadge: {
    fontSize: '12px',
    fontWeight: 'normal',
    color: '#666',
    backgroundColor: '#e8f5e9',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  transcript: {
    lineHeight: '1.8',
    fontSize: '16px',
    color: '#333',
    whiteSpace: 'pre-wrap',
  },
};