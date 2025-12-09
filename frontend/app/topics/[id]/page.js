//frontend/app/topics/[id]/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getApiUrl } from '../../context/AuthContext';

const API_URL = getApiUrl();

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.id;

  const [topic, setTopic] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [deletingTopic, setDeletingTopic] = useState(false);
  const [deletingLectureId, setDeletingLectureId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState(null);

  useEffect(() => {
    if (topicId) {
      fetchTopic();
      fetchLectures();
      fetchMaterials();
    }
  }, [topicId]);

  const fetchTopic = async () => {
    try {
      const response = await fetch(`${API_URL}/topics/${topicId}`);
      const data = await response.json();
      setTopic(data);
    } catch (err) {
      console.error('Error fetching topic:', err);
    }
  };

  const fetchLectures = async () => {
    try {
      const response = await fetch(`${API_URL}/topics/${topicId}/lectures`);
      const data = await response.json();
      setLectures(data);
    } catch (err) {
      console.error('Error fetching lectures:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch(`${API_URL}/topics/${topicId}/materials`);
      const data = await response.json();
      setMaterials(data);
    } catch (err) {
      console.error('Error fetching materials:', err);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) return;

    setUploadingPdf(true);
    
    const formData = new FormData();
    formData.append('pdf', pdfFile);

    try {
      const response = await fetch(`${API_URL}/topics/${topicId}/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('PDF upload failed');
      }

      const data = await response.json();
      alert(`✅ PDF uploaded! Extracted ${data.pages} pages with ${data.extracted_chars} characters.`);
      
      fetchMaterials();
      setPdfFile(null);
      
    } catch (err) {
      alert(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeleteMaterial = async (materialId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;

    setDeletingMaterialId(materialId);

    try {
      const response = await fetch(`${API_URL}/materials/${materialId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete material');
      }

      alert('✅ Material deleted!');
      fetchMaterials();
      
    } catch (err) {
      alert(`❌ Delete failed: ${err.message}`);
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const handleGenerateTopicQuiz = async () => {
    if (!confirm(`Generate a quiz covering all ${lectures.length} lectures in this topic?`)) {
      return;
    }

    setGeneratingQuiz(true);
    setQuiz(null);

    const formData = new FormData();
    formData.append('num_questions', '20');

    try {
      const response = await fetch(`${API_URL}/topics/${topicId}/quiz`, {
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

  const handleDeleteTopic = async () => {
    const confirmMsg = `⚠️ DELETE ENTIRE TOPIC?\n\nThis will permanently delete:\n• This topic\n• ${lectures.length} lectures\n• All materials in those lectures\n\nThis cannot be undone!`;
    
    if (!confirm(confirmMsg)) return;

    setDeletingTopic(true);

    try {
      const response = await fetch(`${API_URL}/topics/${topicId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete topic');
      }

      const data = await response.json();
      alert(`✅ Topic deleted with ${data.deleted_lectures} lectures`);
      router.push('/subjects');
      
    } catch (err) {
      alert(`❌ Delete failed: ${err.message}`);
      setDeletingTopic(false);
    }
  };

  const handleDeleteLecture = async (e, lecture) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmMsg = `⚠️ Delete lecture?\n\n"${lecture.title}"\n\nThis will also delete all materials for this lecture.`;
    
    if (!confirm(confirmMsg)) return;

    setDeletingLectureId(lecture.id);

    try {
      const response = await fetch(`${API_URL}/lectures/${lecture.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete lecture');
      }

      alert('✅ Lecture deleted!');
      fetchLectures();
      
    } catch (err) {
      alert(`❌ Delete failed: ${err.message}`);
    } finally {
      setDeletingLectureId(null);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <Link href="/subjects" style={styles.backLink}>
            ← Back to Subjects
          </Link>
        </div>

        <div style={styles.titleCard}>
          <h1 style={styles.title}>📂 {topic?.name || 'Topic'}</h1>
          {topic?.description && (
            <p style={styles.description}>{topic.description}</p>
          )}
          <div style={styles.titleActions}>
            <Link
              href={`/topics/${topicId}/study`}
              style={{
                ...styles.studyButton,
                ...(lectures.length === 0 ? styles.buttonDisabled : {})
              }}
            >
              🤖 AI Study Assistant
            </Link>
            
            <button
              onClick={handleGenerateTopicQuiz}
              disabled={generatingQuiz || lectures.length === 0}
              style={{
                ...styles.quizButton,
                ...(generatingQuiz || lectures.length === 0 ? styles.buttonDisabled : {})
              }}
            >
              {generatingQuiz ? '⏳ Generating Quiz...' : '📋 Generate Topic Quiz'}
            </button>
            
            <button
              onClick={handleDeleteTopic}
              disabled={deletingTopic}
              style={{
                ...styles.deleteTopicButton,
                ...(deletingTopic ? styles.buttonDisabled : {})
              }}
            >
              {deletingTopic ? '⏳ Deleting...' : '🗑️ Delete Topic'}
            </button>
          </div>
        </div>

        {/* Topic Materials Section */}
        <div style={styles.materialsCard}>
          <h2 style={styles.sectionTitle}>📚 Topic Materials (Shared PDFs)</h2>
          <p style={styles.materialsSubtitle}>
            PDFs uploaded here are shared across all lectures in this topic
          </p>
          
          {/* Upload PDF */}
          <div style={styles.uploadSection}>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files[0])}
              style={styles.fileInput}
            />
            
            {pdfFile && (
              <p style={styles.fileInfo}>
                Selected: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            
            <button
              onClick={handlePdfUpload}
              disabled={!pdfFile || uploadingPdf}
              style={{
                ...styles.uploadButton,
                ...((!pdfFile || uploadingPdf) && styles.uploadButtonDisabled)
              }}
            >
              {uploadingPdf ? '⏳ Uploading...' : '📤 Upload PDF to Topic'}
            </button>
          </div>

          {/* Materials List */}
          {materials.length > 0 && (
            <div style={styles.materialsList}>
              {materials.map((material) => (
                <div key={material.id} style={styles.materialItem}>
                  <span style={styles.materialIcon}>📄</span>
                  <span style={styles.materialName}>{material.file_name}</span>
                  <span style={styles.materialDate}>
                    {formatDate(material.created_at)}
                  </span>
                  <button
                    onClick={() => handleDeleteMaterial(material.id, material.file_name)}
                    disabled={deletingMaterialId === material.id}
                    style={{
                      ...styles.deleteMaterialButton,
                      ...(deletingMaterialId === material.id ? styles.buttonDisabled : {})
                    }}
                  >
                    {deletingMaterialId === material.id ? '⏳' : '🗑️'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {materials.length === 0 && (
            <p style={styles.noMaterials}>No shared materials yet. Upload a PDF that applies to all lectures in this topic.</p>
          )}
        </div>

        {quiz && (
          <div style={styles.quizCard}>
            <div style={styles.quizHeader}>
              <h2 style={styles.quizTitle}>📋 Topic Quiz ({lectures.length} lectures)</h2>
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

        {loading && <p style={styles.loading}>Loading lectures...</p>}

        {!loading && lectures.length === 0 && (
          <div style={styles.empty}>
            <p>No lectures in this topic yet.</p>
            <Link href="/" style={styles.uploadLink}>
              🚀 Upload Lecture
            </Link>
          </div>
        )}

        <div style={styles.lecturesGrid}>
          {lectures.map((lecture, index) => (
            <div key={lecture.id} style={styles.lectureCardWrapper}>
              <Link
                href={`/lectures/${lecture.id}`}
                style={styles.lectureCard}
              >
                <div style={styles.lectureNumber}>#{index + 1}</div>
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
                  View Lecture →
                </div>
              </Link>

              <button
                onClick={(e) => handleDeleteLecture(e, lecture)}
                disabled={deletingLectureId === lecture.id}
                style={{
                  ...styles.deleteLectureButton,
                  ...(deletingLectureId === lecture.id ? styles.buttonDisabled : {})
                }}
              >
                {deletingLectureId === lecture.id ? '⏳' : '🗑️'}
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
    maxWidth: '1000px',
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
  description: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px',
  },
  titleActions: {
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
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  quizButton: {
    padding: '12px 24px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  deleteTopicButton: {
    padding: '12px 24px',
    backgroundColor: '#dc3545',
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
  materialsCard: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '5px',
    color: '#333',
  },
  materialsSubtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '20px',
  },
  uploadSection: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  fileInput: {
    marginBottom: '10px',
  },
  fileInfo: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px',
  },
  uploadButton: {
    padding: '10px 20px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  materialsList: {
    marginTop: '15px',
  },
  materialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '10px',
  },
  materialIcon: {
    fontSize: '20px',
  },
  materialName: {
    flex: 1,
    fontSize: '14px',
    color: '#333',
  },
  materialDate: {
    fontSize: '12px',
    color: '#666',
  },
  deleteMaterialButton: {
    padding: '6px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  noMaterials: {
    color: '#666',
    fontStyle: 'italic',
    padding: '20px',
    textAlign: 'center',
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
  lecturesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  lectureCardWrapper: {
    position: 'relative',
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
    position: 'relative',
  },
  lectureNumber: {
    position: 'absolute',
    top: '15px',
    right: '55px',
    backgroundColor: '#0066cc',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  lectureTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#333',
    paddingRight: '90px',
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
  },
  deleteLectureButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '32px',
    height: '32px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
};