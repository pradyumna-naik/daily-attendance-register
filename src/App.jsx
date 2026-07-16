import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Plus, 
  Save, 
  Printer, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Share2, 
  Download, 
  X,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import './App.css';

// Helper to get formatted local date (YYYY-MM-DD)
const getFormattedDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to generate a unique row ID
const createRowId = () => {
  return 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Create an empty row structure
const createEmptyRow = (dateStr = '') => ({
  id: createRowId(),
  date: dateStr,
  greetings: '',
  myTime: '',
  numerical: '',
  creative: '',
  language: '',
  outdoor: '',
  story: '',
  seeyou: ''
});

// Helper to get the Monday of the calendar week for a given date
const getStartOfWeek = (dateStr) => {
  if (!dateStr) return 'No Date';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'No Date';
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
};

// Formats the Monday date string into a nice range "Jun 15, 2026 - Jun 21, 2026"
const formatWeekRange = (mondayStr) => {
  if (mondayStr === 'No Date') return 'Undated Entries';
  const monday = new Date(mondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${monday.toLocaleDateString('en-US', options)} - ${sunday.toLocaleDateString('en-US', options)}`;
};

function App() {
  const [rows, setRows] = useState([]);
  const [std, setStd] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareBtnRef = useRef(null);

  // New States for Weekly Summary Feature
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'weekly'
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weeklyRemarks, setWeeklyRemarks] = useState({});

  // Toast Notification handler
  const showToast = (text, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const savedRows = localStorage.getItem('attendance_register_rows');
    const savedStd = localStorage.getItem('attendance_register_std');
    const savedRemarks = localStorage.getItem('attendance_weekly_remarks');
    
    if (savedRows) {
      try {
        const parsed = JSON.parse(savedRows);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
        } else {
          setRows([createEmptyRow(getFormattedDate())]);
        }
      } catch (e) {
        console.error('Error loading data from localStorage', e);
        setRows([createEmptyRow(getFormattedDate())]);
      }
    } else {
      setRows([createEmptyRow(getFormattedDate())]);
    }

    if (savedStd) {
      setStd(savedStd);
    } else {
      setStd('');
    }

    if (savedRemarks) {
      try {
        setWeeklyRemarks(JSON.parse(savedRemarks));
      } catch (e) {
        console.error('Error loading weekly remarks', e);
      }
    }

    // Click listener to close share dropdown
    const handleOutsideClick = (e) => {
      if (shareBtnRef.current && !shareBtnRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Auto-resize textareas during printing
  useEffect(() => {
    const handleBeforePrint = () => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      });
    };
    
    const handleAfterPrint = () => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(ta => {
        ta.style.height = '';
      });
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);


  // 2. Auto-save in localStorage on every state change
  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem('attendance_register_rows', JSON.stringify(rows));
    }
  }, [rows]);

  useEffect(() => {
    localStorage.setItem('attendance_register_std', std);
  }, [std]);

  useEffect(() => {
    localStorage.setItem('attendance_weekly_remarks', JSON.stringify(weeklyRemarks));
  }, [weeklyRemarks]);

  // Group rows by calendar week (Monday start)
  const getWeeksData = () => {
    const groups = {};
    rows.forEach(row => {
      const weekStart = getStartOfWeek(row.date);
      if (!groups[weekStart]) {
        groups[weekStart] = [];
      }
      groups[weekStart].push(row);
    });
    
    // Sort weeks chronologically.
    const sortedWeeks = Object.keys(groups).sort((a, b) => {
      if (a === 'No Date') return 1;
      if (b === 'No Date') return -1;
      return new Date(a) - new Date(b);
    });
    
    return { groups, sortedWeeks };
  };

  const { groups, sortedWeeks } = getWeeksData();
  const currentWeek = selectedWeek || (sortedWeeks.length > 0 ? sortedWeeks[0] : '');

  // Sort rows inside the selected week chronologically by date
  const currentWeekRows = (groups[currentWeek] || []).sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  const currentRemarks = weeklyRemarks[currentWeek] || {
    greetings: '',
    myTime: '',
    numerical: '',
    creative: '',
    language: '',
    outdoor: '',
    story: '',
    seeyou: '',
    general: ''
  };

  // Add Row
  const handleAddRow = () => {
    let nextDate = '';
    if (rows.length > 0) {
      const lastDateStr = rows[rows.length - 1].date;
      if (lastDateStr) {
        const lastDate = new Date(lastDateStr);
        if (!isNaN(lastDate.getTime())) {
          lastDate.setDate(lastDate.getDate() + 1);
          nextDate = lastDate.toISOString().split('T')[0];
        }
      }
    }
    if (!nextDate) {
      nextDate = getFormattedDate();
    }
    setRows([...rows, createEmptyRow(nextDate)]);
    showToast('Row added successfully');
  };

  // Delete Row
  const handleDeleteRow = (id) => {
    const updated = rows.filter(r => r.id !== id);
    if (updated.length === 0) {
      // Always keep at least one row
      setRows([createEmptyRow(getFormattedDate())]);
    } else {
      setRows(updated);
    }
    showToast('Row deleted', 'info');
  };

  // Update specific cell value
  const handleCellChange = (id, field, value) => {
    setRows(prevRows => prevRows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // Update weekly remark entries
  const handleWeeklyRemarkChange = (field, value) => {
    setWeeklyRemarks(prev => ({
      ...prev,
      [currentWeek]: {
        ...(prev[currentWeek] || { greetings: '', myTime: '', numerical: '', creative: '', language: '', outdoor: '', story: '', seeyou: '', general: '' }),
        [field]: value
      }
    }));
  };

  // Manual Save (forces localStorage update and shows toast)
  const handleManualSave = () => {
    localStorage.setItem('attendance_register_rows', JSON.stringify(rows));
    localStorage.setItem('attendance_register_std', std);
    localStorage.setItem('attendance_weekly_remarks', JSON.stringify(weeklyRemarks));
    showToast('Saved successfully');
  };

  // Clear All rows
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all register entries? This action cannot be undone.')) {
      setRows([createEmptyRow(getFormattedDate())]);
      setStd('');
      setWeeklyRemarks({});
      localStorage.removeItem('attendance_register_rows');
      localStorage.removeItem('attendance_register_std');
      localStorage.removeItem('attendance_weekly_remarks');
      showToast('All entries cleared', 'info');
    }
  };

  // Print Dialog
  const handlePrint = () => {
    window.print();
  };

  // Helper: Prepare capture-mode element for high-quality screen rendering during PDF/Image generation
  const prepareCaptureElement = async (element) => {
    // Create a temporary wrapper to clone the element into to completely bypass mobile viewport constraints
    const cloneWrapper = document.createElement('div');
    cloneWrapper.style.position = 'absolute';
    cloneWrapper.style.top = '-9999px';
    cloneWrapper.style.left = '0';
    cloneWrapper.style.width = '1200px';
    cloneWrapper.style.backgroundColor = '#ffffff';
    cloneWrapper.style.webkitTextSizeAdjust = '100%';
    cloneWrapper.style.textSizeAdjust = '100%';
    
    const clone = element.cloneNode(true);
    cloneWrapper.appendChild(clone);
    document.body.appendChild(cloneWrapper);
    
    const wrapper = clone.querySelector('.table-wrapper');
    if (wrapper) {
      wrapper.scrollLeft = 0;
    }
    
    // Add custom class to override layout width and toggle capture-only display blocks
    clone.classList.add('capture-mode');

    // Give browser a short window to repaint layout before capture
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      const canvas = await html2canvas(cloneWrapper, {
        scale: 2, // High DPI capture
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1200,
        windowWidth: 1200
      });
      return canvas;
    } finally {
      // Clean up the temporary clone
      document.body.removeChild(cloneWrapper);
    }
  };

  // PDF generation blob builder
  const generatePdfBlob = async () => {
    const activeId = activeTab === 'weekly' ? 'weekly-report-container' : 'register-table-container';
    const element = document.getElementById(activeId);
    if (!element) return null;
    
    const canvas = await prepareCaptureElement(element);
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);
    const ratio = contentWidth / canvas.width;
    const contentHeight = canvas.height * ratio;
    
    // Multi-page slicing if contentHeight exceeds available vertical printable height
    const pageLimitHeight = pdfHeight - (margin * 2);
    if (contentHeight <= pageLimitHeight) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      let remainingHeight = contentHeight;
      let position = margin;
      
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      remainingHeight -= pageLimitHeight;
      
      while (remainingHeight > 0) {
        pdf.addPage();
        position = -pageLimitHeight + position;
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        remainingHeight -= pageLimitHeight;
      }
    }
    
    return pdf.output('blob');
  };

  const getExportFilename = () => {
    const fileDate = getFormattedDate();
    const cleanStd = std.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const prefix = activeTab === 'weekly' ? 'vidyachetana-weekly-summary' : 'vidyachetana-diary';
    const weekSuffix = (activeTab === 'weekly' && currentWeek !== 'No Date') ? `-week-${currentWeek}` : '';
    
    return cleanStd 
      ? `${prefix}-std-${cleanStd}-${fileDate}${weekSuffix}` 
      : `${prefix}-${fileDate}${weekSuffix}`;
  };

  // PDF download trigger
  const handleDownloadPdf = async () => {
    try {
      showToast('Generating PDF file...', 'info');
      const blob = await generatePdfBlob();
      if (!blob) throw new Error('PDF generation failed');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getExportFilename()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('PDF downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to download PDF', 'error');
    }
  };

  // PNG download trigger
  const handleDownloadImage = async () => {
    try {
      showToast('Generating PNG image...', 'info');
      const activeId = activeTab === 'weekly' ? 'weekly-report-container' : 'register-table-container';
      const element = document.getElementById(activeId);
      if (!element) throw new Error('Table element not found');

      const canvas = await prepareCaptureElement(element);
      const url = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.href = url;
      link.download = `${getExportFilename()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Image downloaded successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to download image', 'error');
    }
  };

  // Share API implementation
  const handleShareFile = async (format) => {
    const filename = getExportFilename();
    setShowShareMenu(false);

    try {
      let blob;
      let fullFilename;
      let mimeType;

      if (format === 'pdf') {
        showToast('Preparing PDF for sharing...', 'info');
        blob = await generatePdfBlob();
        fullFilename = `${filename}.pdf`;
        mimeType = 'application/pdf';
      } else if (format === 'png') {
        showToast('Preparing Image for sharing...', 'info');
        const activeId = activeTab === 'weekly' ? 'weekly-report-container' : 'register-table-container';
        const element = document.getElementById(activeId);
        const canvas = await prepareCaptureElement(element);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        fullFilename = `${filename}.png`;
        mimeType = 'image/png';
      }

      if (!blob) throw new Error('Blob generation failed');

      const file = new File([blob], fullFilename, { type: mimeType });

      // Check Web Share File Support
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: activeTab === 'weekly' ? 'VIDYACHETANA DIARY - Weekly Report' : 'VIDYACHETANA DIARY',
          text: activeTab === 'weekly' 
            ? `VIDYACHETANA DIARY Weekly Summary Report for Std ${std || 'N/A'} (Week: ${formatWeekRange(currentWeek)})`
            : `VIDYACHETANA DIARY exported on ${getFormattedDate()}`
        });
        showToast('Shared successfully');
      } else {
        // Fallback: download the file and alert user to share manually
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fullFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('Direct sharing is not supported on this device. File downloaded. Please share it manually through WhatsApp or any other app.');
      }
    } catch (err) {
      console.error(err);
      showToast('Sharing cancelled or failed', 'error');
    }
  };

  // Compile subject-wise activities for auto-summaries
  const getAutoSummary = (rowsList, subject) => {
    const list = rowsList
      .map(r => r[subject] ? r[subject].trim() : '')
      .filter(val => val !== '');
      
    if (list.length === 0) {
      return 'No entries recorded for this block this week.';
    }
    
    return list.map((act, idx) => `${idx + 1}. ${act}`).join('\n');
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast">
            {toast.type === 'success' && <CheckCircle2 size={16} style={{ color: '#0d9488' }} />}
            <span>{toast.text}</span>
            <button 
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 0 }} 
              onClick={() => removeToast(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <header className="no-print">
        <h1>VIDYACHETANA DIARY</h1>
        <p className="subtitle">Fill daily reports, manage entries, and export/share in PDF or PNG format.</p>
      </header>

      {/* Tab Selectors */}
      <div className="tab-container no-print">
        <button 
          className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <Layers size={16} />
          Daily Entries Register
        </button>
        <button 
          className={`tab-btn ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('weekly');
            if (!selectedWeek && sortedWeeks.length > 0) {
              setSelectedWeek(sortedWeeks[0]);
            }
          }}
        >
          <Calendar size={16} />
          Weekly Summary & Report
        </button>
      </div>

      {/* Control Card panel */}
      <div className="controls-card no-print">
        {activeTab === 'daily' ? (
          <button className="btn btn-primary" onClick={handleAddRow}>
            <Plus size={18} />
            Add Row
          </button>
        ) : (
          <div className="week-select-container">
            <label htmlFor="week-select">Select Week: </label>
            <select 
              id="week-select" 
              value={currentWeek} 
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="week-select-dropdown"
            >
              {sortedWeeks.map(wk => (
                <option key={wk} value={wk}>
                  {formatWeekRange(wk)}
                </option>
              ))}
              {sortedWeeks.length === 0 && (
                <option value="">No Dates Logged</option>
              )}
            </select>
          </div>
        )}
        
        <button className="btn btn-primary" style={{ backgroundColor: '#0f766e' }} onClick={handleManualSave}>
          <Save size={18} />
          Save
        </button>
        
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={18} />
          Print
        </button>

        <span style={{ borderLeft: '1px solid #cbd5e1', height: '24px', margin: '0 0.5rem' }}></span>

        <button className="btn btn-pdf" onClick={handleDownloadPdf}>
          <Download size={16} />
          Download PDF
        </button>

        <button className="btn btn-image" onClick={handleDownloadImage}>
          <Download size={16} />
          Download Image
        </button>

        {/* Share Button with format dropdown popover */}
        <div style={{ position: 'relative' }} ref={shareBtnRef}>
          <button className="btn btn-share" onClick={() => setShowShareMenu(!showShareMenu)}>
            <Share2 size={16} />
            Share
          </button>
          
          {showShareMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '0',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              zIndex: '100',
              marginTop: '0.25rem',
              minWidth: '150px'
            }}>
              <button 
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => handleShareFile('pdf')}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <FileText size={14} style={{ color: '#e11d48' }} />
                Share PDF
              </button>
              <button 
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => handleShareFile('png')}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <ImageIcon size={14} style={{ color: '#d97706' }} />
                Share Image
              </button>
            </div>
          )}
        </div>

        <span style={{ borderLeft: '1px solid #cbd5e1', height: '24px', margin: '0 0.5rem' }}></span>

        <button className="btn btn-danger" onClick={handleClearAll}>
          <Trash2 size={18} />
          Clear All
        </button>
      </div>

      {activeTab === 'daily' ? (
        /* Main Table Register Card */
        <div className="table-card print-area" id="register-table-container">
          <div className="diary-meta-bar no-print-layout">
            <div className="diary-std-container">
              <span>std:</span>
              <input 
                type="text" 
                value={std} 
                onChange={(e) => setStd(e.target.value)} 
                className="diary-std-input no-capture-print" 
                placeholder="e.g. 1st, 2nd"
              />
              <span className="diary-std-input-text capture-print-only-inline">
                {std || '____'}
              </span>
            </div>
            <span className="diary-form-title">VIDYACHETANA DIARY</span>
          </div>

          <div className="table-wrapper">
            <table className="register-table">
              <colgroup>
                <col className="col-1" />
                <col className="col-2" />
                <col className="col-mytime" />
                <col className="col-3" />
                <col className="col-4" />
                <col className="col-5" />
                <col className="col-6" />
                <col className="col-7" />
                <col className="col-8" />
              </colgroup>
              <thead>
                <tr>
                  <th>Day / Date</th>
                  <th>Exchange of greetings & conversation</th>
                  <th>My time</th>
                  <th>Basic numerical knowledge</th>
                  <th>Creative Arts</th>
                  <th>Language Development</th>
                  <th>Outdoor Games</th>
                  <th>Story Time</th>
                  <th>See You Again</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="date-cell-container">
                        <input 
                          type="date" 
                          value={row.date} 
                          onChange={(e) => handleCellChange(row.id, 'date', e.target.value)} 
                          className="date-input no-capture-print" 
                        />
                        <span className="date-input-text capture-print-only-block">
                          {row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}
                        </span>
                        <button 
                          className="btn-row-delete no-print" 
                          onClick={() => handleDeleteRow(row.id)}
                          title="Delete Row"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.greetings} 
                          onChange={(e) => handleCellChange(row.id, 'greetings', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.greetings}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.myTime} 
                          onChange={(e) => handleCellChange(row.id, 'myTime', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.myTime}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.numerical} 
                          onChange={(e) => handleCellChange(row.id, 'numerical', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.numerical}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.creative} 
                          onChange={(e) => handleCellChange(row.id, 'creative', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.creative}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.language} 
                          onChange={(e) => handleCellChange(row.id, 'language', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.language}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.outdoor} 
                          onChange={(e) => handleCellChange(row.id, 'outdoor', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.outdoor}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.story} 
                          onChange={(e) => handleCellChange(row.id, 'story', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.story}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.seeyou} 
                          onChange={(e) => handleCellChange(row.id, 'seeyou', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Enter details..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.seeyou}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom signature section */}
          <div className="signature-section">
            <div className="sig-block">
              <div>ವರ್ಗ ಶಿಕ್ಷಕರು / Class Teacher</div>
              <div className="sig-line">Signature: ______________________</div>
            </div>
            <div className="sig-block" style={{ textAlign: 'right' }}>
              <div>ಮುಖ್ಯೋಪಾಧ್ಯಾಯರು / Head Master</div>
              <div className="sig-line">Signature: ______________________</div>
            </div>
          </div>
        </div>
      ) : (
        /* Weekly Summary Report Card */
        <div className="table-card print-area" id="weekly-report-container">
          <div className="diary-meta-bar">
            <div className="diary-std-container">
              <span>std:</span>
              <input 
                type="text" 
                value={std} 
                onChange={(e) => setStd(e.target.value)} 
                className="diary-std-input no-capture-print" 
                placeholder="e.g. 1st, 2nd"
              />
              <span className="diary-std-input-text capture-print-only-inline">
                {std || '____'}
              </span>
            </div>
            <span className="diary-form-title">Weekly Summary Report</span>
            <div className="diary-week-display">
              {formatWeekRange(currentWeek)}
            </div>
          </div>

          {/* Table layout of the week's entries */}
          <div className="weekly-section-title">Daily Logs for this Week</div>
          <div className="table-wrapper">
            <table className="register-table weekly-compact-table">
              <colgroup>
                <col className="col-1" />
                <col className="col-2" />
                <col className="col-mytime" />
                <col className="col-3" />
                <col className="col-4" />
                <col className="col-5" />
                <col className="col-6" />
                <col className="col-7" />
                <col className="col-8" />
              </colgroup>
              <thead>
                <tr>
                  <th>Day / Date</th>
                  <th>Exchange of greetings & conversation</th>
                  <th>My time</th>
                  <th>Basic numerical knowledge</th>
                  <th>Creative Arts</th>
                  <th>Language Development</th>
                  <th>Outdoor Games</th>
                  <th>Story Time</th>
                  <th>See You Again</th>
                </tr>
              </thead>
              <tbody>
                {currentWeekRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="weekly-date-cell">
                        {row.date ? new Date(row.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No Date'}
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.greetings} 
                          onChange={(e) => handleCellChange(row.id, 'greetings', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Greetings..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.greetings}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.myTime} 
                          onChange={(e) => handleCellChange(row.id, 'myTime', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="My Time..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.myTime}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.numerical} 
                          onChange={(e) => handleCellChange(row.id, 'numerical', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Numerical..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.numerical}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.creative} 
                          onChange={(e) => handleCellChange(row.id, 'creative', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Creative..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.creative}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.language} 
                          onChange={(e) => handleCellChange(row.id, 'language', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Language..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.language}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.outdoor} 
                          onChange={(e) => handleCellChange(row.id, 'outdoor', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Outdoor..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.outdoor}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.story} 
                          onChange={(e) => handleCellChange(row.id, 'story', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="Story..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.story}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-textarea-wrapper">
                        <textarea 
                          value={row.seeyou} 
                          onChange={(e) => handleCellChange(row.id, 'seeyou', e.target.value)} 
                          className="cell-textarea no-capture-print" 
                          placeholder="See You..."
                        />
                        <div className="cell-textarea-text capture-print-only-block">
                          {row.seeyou}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {currentWeekRows.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No entries recorded for this week.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Subject summaries grid */}
          <div className="weekly-section-title page-break-before-print">Weekly Section Summaries & Reflections</div>
          <div className="weekly-summaries-grid">
            {/* Greetings */}
            <div className="weekly-subject-box">
              <div className="subject-box-header greetings-theme">Greetings & Conversation</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'greetings')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.greetings} 
                    onChange={(e) => handleWeeklyRemarkChange('greetings', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.greetings}
                  </div>
                </div>
              </div>
            </div>

            {/* My Time */}
            <div className="weekly-subject-box">
              <div className="subject-box-header mytime-theme">My time</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'myTime')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.myTime} 
                    onChange={(e) => handleWeeklyRemarkChange('myTime', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.myTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Numerical */}
            <div className="weekly-subject-box">
              <div className="subject-box-header numerical-theme">Numerical Knowledge</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'numerical')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.numerical} 
                    onChange={(e) => handleWeeklyRemarkChange('numerical', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.numerical}
                  </div>
                </div>
              </div>
            </div>

            {/* Creative */}
            <div className="weekly-subject-box">
              <div className="subject-box-header creative-theme">Creative Arts</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'creative')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.creative} 
                    onChange={(e) => handleWeeklyRemarkChange('creative', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.creative}
                  </div>
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="weekly-subject-box">
              <div className="subject-box-header language-theme">Language Development</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'language')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.language} 
                    onChange={(e) => handleWeeklyRemarkChange('language', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.language}
                  </div>
                </div>
              </div>
            </div>

            {/* Outdoor */}
            <div className="weekly-subject-box">
              <div className="subject-box-header outdoor-theme">Outdoor Games</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'outdoor')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.outdoor} 
                    onChange={(e) => handleWeeklyRemarkChange('outdoor', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.outdoor}
                  </div>
                </div>
              </div>
            </div>

            {/* Story */}
            <div className="weekly-subject-box">
              <div className="subject-box-header story-theme">Story Time</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'story')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.story} 
                    onChange={(e) => handleWeeklyRemarkChange('story', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.story}
                  </div>
                </div>
              </div>
            </div>

            {/* See You */}
            <div className="weekly-subject-box">
              <div className="subject-box-header seeyou-theme">See You Again</div>
              <div className="subject-box-body">
                <div className="auto-summary-label">Compiled Logs:</div>
                <pre className="auto-summary-content">{getAutoSummary(currentWeekRows, 'seeyou')}</pre>
                
                <div className="remarks-label">Weekly Remarks:</div>
                <div className="weekly-remark-textarea-wrapper">
                  <textarea 
                    value={currentRemarks.seeyou} 
                    onChange={(e) => handleWeeklyRemarkChange('seeyou', e.target.value)} 
                    className="weekly-remark-textarea no-capture-print"
                    placeholder="Enter reflections..."
                  />
                  <div className="weekly-remark-textarea-text capture-print-only-block">
                    {currentRemarks.seeyou}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* General weekly reflections */}
          <div className="weekly-general-remarks">
            <div className="remarks-label">General Remarks / Learning Objectives Achieved / Reflections:</div>
            <div className="weekly-general-textarea-wrapper">
              <textarea 
                value={currentRemarks.general} 
                onChange={(e) => handleWeeklyRemarkChange('general', e.target.value)} 
                className="weekly-general-textarea no-capture-print"
                placeholder="Enter general weekly reflections and observations..."
              />
              <div className="weekly-general-textarea-text capture-print-only-block">
                {currentRemarks.general}
              </div>
            </div>
          </div>

          {/* Bottom signature section */}
          <div className="signature-section">
            <div className="sig-block">
              <div>ವರ್ಗ ಶಿಕ್ಷಕರು / Class Teacher</div>
              <div className="sig-line">Signature: ______________________</div>
            </div>
            <div className="sig-block" style={{ textAlign: 'right' }}>
              <div>ಮುಖ್ಯೋಪಾಧ್ಯಾಯರು / Head Master</div>
              <div className="sig-line">Signature: ______________________</div>
            </div>
          </div>
        </div>
      )}

      <div className="footer-note no-print">
        <p>This web app operates entirely in your browser. All inputs are automatically saved locally.</p>
      </div>
    </div>
  );
}

export default App;