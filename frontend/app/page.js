//frontend/app/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from './context/AuthContext';

const API_URL = getApiUrl();

export default function Home() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`${API_URL}/subjects`);
      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const fetchTopicsForSubject = async (subjectId) => {
    try {
      const response = await fetch(`${API_URL}/subjects/${subjectId}/topics`);
      const data = await response.json();
      setTopics(data);
    } catch (err) {
      console.error('Error fetching topics:', err);
      setTopics([]);
    }
  };

  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId);
    setSelectedTopic('');
    if (subjectId) {
      fetchTopicsForSubject(subjectId);
    } else {
      setTopics([]);
    }
  };

  const assignLectureToTopic = async (lectureId, topicId) => {
    const formData = new FormData();
    formData.append('topic_id', topicId);

    try {
      await fetch(`${API_URL}/lectures/${lectureId}/topic`, {
        method: 'PUT',
        body: formData,
      });
    } catch (err) {
      console.error('Failed to assign lecture to topic:', err);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an audio file');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', title || 'Untitled Lecture');

    try {
      const response = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json();
      setResult(data);

      // Auto-assign to topic if selected
      if (selectedTopic) {
        await assignLectureToTopic(data.lecture_id, selectedTopic);
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile || !result?.lecture_id) {
      setError('Please transcribe audio first, then upload PDF');
      return;
    }

    setUploadingPdf(true);
    
    const formData = new FormData();
    formData.append('pdf', pdfFile);

    try {
      const response = await fetch(`${API_URL}/lectures/${result.lecture_id}/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('PDF upload failed');
      }

      const data = await response.json();
      alert(`✅ PDF uploaded! Extracted ${data.pages} pages.`);
      setPdfFile(null);
      
    } catch (err) {
      setError(`PDF upload failed: ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>🎓 Lecture Transcription MVP</h1>
        <p style={styles.subtitle}>Free transcription with Whisper + Groq</p>

        <Link href="/subjects" style={styles.viewSubjectsLink}>
          📁 Browse Subjects
        </Link>
        <Link href="/lectures" style={styles.viewLecturesLink}>
          📚 View All Lectures
        </Link>
        
        <div style={styles.card}>
          <label style={styles.label}>Lecture Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Biology 101 - Cell Division"
            style={styles.input}
          />

          {/* FOLDER ORGANIZATION SECTION */}
          <label style={styles.label}>Organize (Optional)</label>
          <div style={styles.organizeSection}>
            <select
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              style={styles.select}
            >
              <option value="">-- No Subject --</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  📁 {subject.name}
                </option>
              ))}
            </select>

            {selectedSubject && (
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={styles.select}
              >
                <option value="">-- No Topic --</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    📂 {topic.name}
                  </option>
                ))}
              </select>
            )}

            {!selectedSubject && subjects.length === 0 && (
              <Link href="/subjects" style={styles.createSubjectLink}>
                ➕ Create Subject/Topic
              </Link>
            )}
          </div>

          <label style={styles.label}>Audio File</label>
          <input
            type="file"
            accept="audio/*,video/mp4"
            onChange={(e) => setFile(e.target.files[0])}
            style={styles.fileInput}
          />
          
          {file && (
            <p style={styles.fileInfo}>
              📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}

          <label style={styles.label}>Course Material (PDF) - Optional</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files[0])}
            style={styles.fileInput}
          />
          
          {pdfFile && (
            <p style={styles.fileInfo}>
              📄 {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}

          <button
            onClick={handleUpload}
            disabled={loading || !file}
            style={{
              ...styles.button,
              ...(loading || !file ? styles.buttonDisabled : {})
            }}
          >
            {loading ? '⏳ Transcribing...' : '🚀 Upload & Transcribe'}
          </button>
          
          {loading && (
            <p style={styles.loadingText}>
              ⏱️ This may take a few minutes for longer recordings...
            </p>
          )}
        </div>

        {error && (
          <div style={styles.error}>❌ {error}</div>
        )}

        {result && (
          <div style={styles.results}>
            <h2 style={styles.resultsTitle}>✅ Transcription Complete!</h2>
            
            <div style={styles.resultCard}>
              <strong>Lecture ID:</strong>
              <code style={styles.code}>{result.lecture_id}</code>
            </div>

            {selectedTopic && (
              <div style={styles.resultCard}>
                <strong>✅ Organized:</strong> Lecture assigned to selected topic
              </div>
            )}

            <div style={styles.resultCard}>
              <strong>Duration:</strong> {result.duration_seconds}s
              <br />
              <strong>Raw transcript:</strong> {result.raw_length} characters
              <br />
              <strong>Cleaned transcript:</strong> {result.cleaned_length} characters
            </div>

            <div style={styles.resultCard}>
              <h3 style={styles.previewTitle}>📝 Cleaned Transcript Preview:</h3>
              <p style={styles.transcript}>{result.cleaned_preview}</p>
            </div>

            {pdfFile && !uploadingPdf && (
              <div style={styles.resultCard}>
                <h3 style={styles.previewTitle}>📄 Upload Course Material</h3>
                <p style={{marginBottom: '10px'}}>
                  Ready to upload: {pdfFile.name}
                </p>
                <button
                  onClick={handlePdfUpload}
                  style={styles.pdfUploadButton}
                >
                  📤 Upload PDF to This Lecture
                </button>
              </div>
            )}

            {uploadingPdf && (
              <div style={styles.resultCard}>
                <p style={styles.loadingText}>⏳ Uploading and extracting PDF text...</p>
              </div>
            )}
          </div>
        )}
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
    maxWidth: '800px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px',
  },
  card: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontWeight: '600',
    marginBottom: '8px',
    marginTop: '15px',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  organizeSection: {
    display: 'flex',
    gap: '10px',
    flexDirection: 'column',
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  createSubjectLink: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center',
  },
  fileInput: {
    width: '100%',
    padding: '10px',
  },
  fileInfo: {
    fontSize: '14px',
    color: '#666',
    marginTop: '8px',
  },
  button: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '20px',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    marginTop: '10px',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  results: {
    marginTop: '30px',
  },
  resultsTitle: {
    fontSize: '24px',
    marginBottom: '20px',
  },
  resultCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  code: {
    backgroundColor: '#f5f5f5',
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '12px',
    display: 'block',
    marginTop: '5px',
  },
  previewTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '10px',
  },
  transcript: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    color: '#333',
  },
  viewSubjectsLink: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    marginBottom: '20px',
    marginRight: '10px',
    fontWeight: '600',
  },
  viewLecturesLink: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    marginBottom: '20px',
    fontWeight: '600',
  },
  pdfUploadButton: {
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};