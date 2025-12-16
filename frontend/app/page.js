//frontend/app/page.js

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getApiUrl } from './context/AuthContext';

const API_URL = getApiUrl();

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italian' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, authFetch, currentClass } = useAuth();
  
  const [files, setFiles] = useState([]);
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
  const [language, setLanguage] = useState('en');
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (!authLoading && isAuthenticated && !currentClass) {
      router.push('/classes');
      return;
    }
    
    if (isAuthenticated && currentClass) {
      fetchSubjects();
    }
    
    const savedLanguage = localStorage.getItem('transcription_language');
    if (savedLanguage && LANGUAGES.some(l => l.code === savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, [isAuthenticated, authLoading, currentClass]);

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('transcription_language', newLanguage);
  };

  if (authLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <p style={{ textAlign: 'center', padding: '100px 20px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentClass) {
    return null;
  }

  const fetchSubjects = async () => {
    try {
      const response = await authFetch(`${API_URL}/classes/${currentClass.id}/subjects`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setSubjects([]);
        return;
      }
      const data = await response.json();
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setSubjects([]);
    }
  };

  const fetchTopicsForSubject = async (subjectId) => {
    try {
      const response = await authFetch(`${API_URL}/subjects/${subjectId}/topics`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setTopics([]);
        return;
      }
      const data = await response.json();
      setTopics(Array.isArray(data) ? data : []);
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

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 10) {
      setError('Maximum 10 files allowed per upload');
      return;
    }
    setFiles(selectedFiles);
    setError('');
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getTotalSize = () => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    return (totalBytes / 1024 / 1024).toFixed(2);
  };

  const assignLectureToTopic = async (lectureId, topicId) => {
    const formData = new FormData();
    formData.append('topic_id', topicId);
    try {
      await authFetch(`${API_URL}/lectures/${lectureId}/topic`, {
        method: 'PUT',
        body: formData,
      });
    } catch (err) {
      console.error('Failed to assign lecture to topic:', err);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one audio file');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setUploadProgress('Preparing upload...');
    
    const formData = new FormData();
    
    // Use different endpoint based on number of files
    const endpoint = files.length === 1 ? '/transcribe' : '/transcribe-multi';
    
    if (files.length === 1) {
      formData.append('audio', files[0]);
    } else {
      files.forEach((file) => {
        formData.append('audio_files', file);
      });
    }
    
    formData.append('title', title || 'Untitled Lecture');
    formData.append('language', language);
    if (selectedTopic) {
      formData.append('topic_id', selectedTopic);
    }

    try {
      setUploadProgress(`Uploading ${files.length} file(s)... This may take a few minutes.`);
      
      const response = await authFetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json();
      setResult(data);
      setUploadProgress('');
      
    } catch (err) {
      setError(err.message);
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
      setUploadProgress('');
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
      const response = await authFetch(`${API_URL}/lectures/${result.lecture_id}/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('PDF upload failed');
      }

      const data = await response.json();
      alert(`PDF uploaded! Extracted ${data.pages} pages.`);
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
        <h1 style={styles.title}>🎓 Lecture Transcription</h1>
        <p style={styles.subtitle}>
          Class: <strong>{currentClass.name}</strong>
        </p>

        <div style={styles.navLinks}>
          <Link href="/classes" style={styles.navLink}>Switch Class</Link>
          <Link href="/subjects" style={styles.navLink}>Browse Subjects</Link>
          <Link href="/lectures" style={styles.navLink}>View All Lectures</Link>
        </div>
        
        <div style={styles.card}>
          <label style={styles.label}>Lecture Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Biology 101 - Cell Division"
            style={styles.input}
          />

          <label style={styles.label}>Organize (Optional)</label>
          <div style={styles.organizeSection}>
            <select
              value={selectedSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              style={styles.select}
            >
              <option value="">-- No Subject --</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
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
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            )}

            {subjects.length === 0 && (
              <Link href="/subjects" style={styles.createSubjectLink}>+ Create Subject/Topic</Link>
            )}
          </div>

          <label style={styles.label}>
            Audio Files 
            <span style={styles.labelHint}>(Select multiple for multi-part lectures)</span>
          </label>
          <input
            type="file"
            accept="audio/*,video/mp4"
            multiple
            onChange={handleFileSelect}
            style={styles.fileInput}
          />
          
          {files.length > 0 && (
            <div style={styles.fileList}>
              <p style={styles.fileListHeader}>
                📁 {files.length} file(s) selected ({getTotalSize()} MB total)
              </p>
              {files.map((file, index) => (
                <div key={index} style={styles.fileItem}>
                  <span style={styles.fileName}>
                    {index + 1}. {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    style={styles.removeFileButton}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {files.length > 1 && (
                <p style={styles.multiFileNote}>
                  ℹ️ Multiple files will be transcribed and combined into one lecture in order.
                </p>
              )}
            </div>
          )}

          <label style={styles.label}>Audio Language</label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={styles.select}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
          <p style={styles.languageHint}>
            Select the language spoken in the audio. Your choice will be remembered.
          </p>

          <label style={styles.label}>Course Material (PDF) - Optional</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files[0])}
            style={styles.fileInput}
          />
          
          {pdfFile && (
            <p style={styles.fileInfo}>
              PDF: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}

          <div style={styles.featureNote}>
            <strong>✨ New Features:</strong>
            <ul style={styles.featureList}>
              <li>🔄 <strong>Auto-splitting:</strong> Large files ({'>'}25MB) are automatically split</li>
              <li>📁 <strong>Multi-file:</strong> Upload multiple parts (e.g., before/after break)</li>
              <li>📊 <strong>Tables:</strong> AI can now format comparisons as tables</li>
            </ul>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || files.length === 0}
            style={{
              ...styles.button,
              ...(loading || files.length === 0 ? styles.buttonDisabled : {})
            }}
          >
            {loading ? '⏳ Transcribing...' : `🚀 Upload & Transcribe${files.length > 1 ? ` (${files.length} files)` : ''}`}
          </button>
          
          {uploadProgress && (
            <p style={styles.loadingText}>{uploadProgress}</p>
          )}
        </div>

        {error && <div style={styles.error}>❌ {error}</div>}

        {result && (
          <div style={styles.results}>
            <h2 style={styles.resultsTitle}>✅ Transcription Complete!</h2>
            
            <div style={styles.resultCard}>
              <strong>Lecture ID:</strong>
              <code style={styles.code}>{result.lecture_id}</code>
            </div>

            <div style={styles.resultCard}>
              <strong>Duration:</strong> {Math.floor(result.duration_seconds / 60)}m {result.duration_seconds % 60}s
              <br />
              <strong>Language:</strong> {result.language_name || 'English'}
              <br />
              {result.files_processed && (
                <><strong>Files processed:</strong> {result.files_processed}<br /></>
              )}
              {result.chunks_processed && result.chunks_processed > 1 && (
                <><strong>Chunks processed:</strong> {result.chunks_processed}<br /></>
              )}
              <strong>Transcript length:</strong> {result.cleaned_length.toLocaleString()} characters
            </div>

            <div style={styles.resultCard}>
              <h3 style={styles.previewTitle}>Cleaned Transcript Preview:</h3>
              <p style={styles.transcript}>{result.cleaned_preview}</p>
            </div>

            {pdfFile && !uploadingPdf && (
              <div style={styles.resultCard}>
                <h3 style={styles.previewTitle}>Upload Course Material</h3>
                <p style={{marginBottom: '10px'}}>Ready to upload: {pdfFile.name}</p>
                <button onClick={handlePdfUpload} style={styles.pdfUploadButton}>
                  Upload PDF to This Lecture
                </button>
              </div>
            )}

            {uploadingPdf && (
              <div style={styles.resultCard}>
                <p style={styles.loadingText}>Uploading and extracting PDF text...</p>
              </div>
            )}

            <div style={styles.resultCard}>
              <Link href={`/lectures/${result.lecture_id}`} style={styles.viewLectureLink}>
                📖 View Full Lecture
              </Link>
              <Link href={`/lectures/${result.lecture_id}/study`} style={styles.studyLink}>
                🤖 Start Studying with AI
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', padding: '40px 20px', backgroundColor: '#f5f5f5' },
  content: { maxWidth: '800px', margin: '0 auto' },
  title: { fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' },
  subtitle: { fontSize: '16px', color: '#666', marginBottom: '20px' },
  navLinks: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  navLink: { display: 'inline-block', padding: '10px 20px', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: '600' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' },
  label: { display: 'block', fontWeight: '600', marginBottom: '8px', marginTop: '15px' },
  labelHint: { fontWeight: 'normal', fontSize: '12px', color: '#666', marginLeft: '8px' },
  input: { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
  organizeSection: { display: 'flex', gap: '10px', flexDirection: 'column' },
  select: { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', backgroundColor: 'white' },
  languageHint: { fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '0' },
  createSubjectLink: { display: 'inline-block', padding: '8px 16px', backgroundColor: '#17a2b8', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '14px', textAlign: 'center' },
  fileInput: { width: '100%', padding: '10px' },
  fileList: { backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginTop: '10px' },
  fileListHeader: { fontWeight: '600', marginBottom: '10px', color: '#333' },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' },
  fileName: { fontSize: '14px', color: '#555' },
  removeFileButton: { backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' },
  multiFileNote: { marginTop: '10px', fontSize: '13px', color: '#666', backgroundColor: '#e3f2fd', padding: '8px 12px', borderRadius: '4px' },
  fileInfo: { fontSize: '14px', color: '#666', marginTop: '8px' },
  featureNote: { backgroundColor: '#e8f5e9', padding: '15px', borderRadius: '4px', marginTop: '20px', marginBottom: '10px' },
  featureList: { margin: '10px 0 0 0', paddingLeft: '20px', fontSize: '14px' },
  button: { width: '100%', padding: '15px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '20px' },
  buttonDisabled: { backgroundColor: '#ccc', cursor: 'not-allowed' },
  loadingText: { textAlign: 'center', color: '#666', fontSize: '14px', marginTop: '10px' },
  error: { backgroundColor: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '4px', marginBottom: '20px' },
  results: { marginTop: '30px' },
  resultsTitle: { fontSize: '24px', marginBottom: '20px' },
  resultCard: { backgroundColor: 'white', padding: '20px', borderRadius: '4px', marginBottom: '15px' },
  code: { backgroundColor: '#f5f5f5', padding: '4px 8px', borderRadius: '3px', fontSize: '12px', display: 'block', marginTop: '5px' },
  previewTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '10px' },
  transcript: { whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333' },
  pdfUploadButton: { padding: '12px 24px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  viewLectureLink: { display: 'inline-block', padding: '12px 24px', backgroundColor: '#0066cc', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: '600', marginRight: '10px' },
  studyLink: { display: 'inline-block', padding: '12px 24px', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: '600' },
};