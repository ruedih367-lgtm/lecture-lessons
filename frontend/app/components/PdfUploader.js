// frontend/app/components/PdfUploader.js
// This is a NEW file - create the components folder if it doesn't exist

'use client';

import { useState } from 'react';
import { getApiUrl } from '../context/AuthContext';

const API_URL = getApiUrl();

export default function PdfUploader({ targetType, targetId, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [error, setError] = useState('');

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file');
      return;
    }

    setFile(selectedFile);
    setError('');
    setPdfInfo(null);
    setSelectedPages(new Set());

    setPreviewing(true);
    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      const response = await fetch(`${API_URL}/pdf/preview`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to read PDF');
      }

      const data = await response.json();
      setPdfInfo(data);
      setSelectedPages(new Set(data.pages.map(p => p.page_number)));
    } catch (err) {
      setError(`Failed to preview PDF: ${err.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const togglePage = (pageNum) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum);
    } else {
      newSelected.add(pageNum);
    }
    setSelectedPages(newSelected);
  };

  const selectAll = () => {
    if (pdfInfo) {
      setSelectedPages(new Set(pdfInfo.pages.map(p => p.page_number)));
    }
  };

  const selectNone = () => {
    setSelectedPages(new Set());
  };

  const selectRange = () => {
    const start = prompt('Start page:', '1');
    const end = prompt('End page:', pdfInfo?.total_pages?.toString() || '1');
    
    if (start && end) {
      const startNum = parseInt(start);
      const endNum = parseInt(end);
      if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum) {
        const newSelected = new Set();
        for (let i = startNum; i <= endNum && i <= (pdfInfo?.total_pages || 0); i++) {
          newSelected.add(i);
        }
        setSelectedPages(newSelected);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || selectedPages.size === 0) {
      setError('Please select at least one page');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('selected_pages', Array.from(selectedPages).sort((a, b) => a - b).join(','));

    const endpoint = targetType === 'lecture' 
      ? `${API_URL}/lectures/${targetId}/upload-pdf`
      : `${API_URL}/topics/${targetId}/upload-pdf`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      setFile(null);
      setPdfInfo(null);
      setSelectedPages(new Set());
      
      if (onUploadComplete) {
        onUploadComplete(data);
      }

      alert(`PDF uploaded! ${data.pages_used} of ${data.total_pages} pages extracted.`);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPdfInfo(null);
    setSelectedPages(new Set());
    setError('');
  };

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}

      {!pdfInfo && (
        <div style={styles.uploadSection}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={styles.fileInput}
            disabled={previewing}
          />
          {previewing && <p style={styles.loadingText}>Reading PDF...</p>}
        </div>
      )}

      {pdfInfo && (
        <div style={styles.pageSelector}>
          <div style={styles.pdfHeader}>
            <h3 style={styles.pdfTitle}>{pdfInfo.filename}</h3>
            <p style={styles.pdfInfo}>
              {pdfInfo.total_pages} pages - {selectedPages.size} selected
            </p>
          </div>

          <div style={styles.quickActions}>
            <button onClick={selectAll} style={styles.quickButton}>
              Select All
            </button>
            <button onClick={selectNone} style={styles.quickButton}>
              Select None
            </button>
            <button onClick={selectRange} style={styles.quickButton}>
              Select Range...
            </button>
          </div>

          <div style={styles.pageGrid}>
            {pdfInfo.pages.map((page) => (
              <div
                key={page.page_number}
                onClick={() => togglePage(page.page_number)}
                style={{
                  ...styles.pageItem,
                  ...(selectedPages.has(page.page_number) ? styles.pageItemSelected : {})
                }}
              >
                <div style={styles.pageNumber}>
                  <input
                    type="checkbox"
                    checked={selectedPages.has(page.page_number)}
                    onChange={() => togglePage(page.page_number)}
                    style={styles.checkbox}
                  />
                  Page {page.page_number}
                </div>
                <p style={styles.pagePreview}>
                  {page.preview || '(empty page)'}
                </p>
                <span style={styles.charCount}>{page.char_count} chars</span>
              </div>
            ))}
          </div>

          <div style={styles.actions}>
            <button
              onClick={handleUpload}
              disabled={uploading || selectedPages.size === 0}
              style={{
                ...styles.uploadButton,
                ...(uploading || selectedPages.size === 0 ? styles.buttonDisabled : {})
              }}
            >
              {uploading ? 'Uploading...' : `Upload ${selectedPages.size} Pages`}
            </button>
            <button onClick={handleCancel} style={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
    fontSize: '14px',
  },
  uploadSection: {
    textAlign: 'center',
  },
  fileInput: {
    marginBottom: '10px',
  },
  loadingText: {
    color: '#666',
    fontSize: '14px',
  },
  pageSelector: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
  },
  pdfHeader: {
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #eee',
  },
  pdfTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '5px',
  },
  pdfInfo: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  quickActions: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
    flexWrap: 'wrap',
  },
  quickButton: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  pageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '20px',
    padding: '5px',
  },
  pageItem: {
    padding: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'white',
  },
  pageItemSelected: {
    borderColor: '#28a745',
    backgroundColor: '#f0fff4',
  },
  pageNumber: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '600',
    fontSize: '14px',
    marginBottom: '8px',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  pagePreview: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    lineHeight: '1.4',
    maxHeight: '60px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  charCount: {
    fontSize: '11px',
    color: '#999',
    display: 'block',
    marginTop: '8px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    paddingTop: '15px',
    borderTop: '1px solid #eee',
  },
  uploadButton: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  cancelButton: {
    padding: '12px 24px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
};