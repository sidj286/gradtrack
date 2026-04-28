// src/ImportMasterListModal.tsx
import React, { useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { 
  parseFile, 
  validateAndTransformData, 
  getPreviewData,
  REQUIRED_COLUMNS,
  type MasterListRecord,
  type ImportResult
} from './lib/importUtils';

interface ImportMasterListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportMasterListModal({ isOpen, onClose, onImportComplete }: ImportMasterListModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRecords, setParsedRecords] = useState<MasterListRecord[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!['csv', 'xlsx', 'xls'].includes(fileExt || '')) {
      setValidationErrors(['Please upload CSV or Excel files only.']);
      return;
    }
    
    setFile(selectedFile);
    setValidationErrors([]);
    setImportResult(null);
    
    try {
      const parsed = await parseFile(selectedFile);
      
      const missingColumns = REQUIRED_COLUMNS.filter(col => !parsed.headers.includes(col));
      if (missingColumns.length > 0) {
        setValidationErrors([`Missing required columns: ${missingColumns.join(', ')}`]);
        setPreviewData([]);
        setParsedRecords([]);
        return;
      }
      
      const { valid, errors } = validateAndTransformData(parsed.data);
      
      if (errors.length > 0) {
        setValidationErrors(errors.slice(0, 10));
      }
      
      setParsedRecords(valid);
      setPreviewData(getPreviewData(valid));
      
      if (valid.length === 0) {
        setValidationErrors(prev => [...prev, 'No valid records found in file']);
      }
      
    } catch (error) {
      console.error('Parse error:', error);
      setValidationErrors(['Failed to parse file. Please check the format.']);
      setPreviewData([]);
      setParsedRecords([]);
    }
  };

  const handleImport = async () => {
    if (parsedRecords.length === 0) {
      setImportResult({
        success: false,
        message: 'No valid records to import',
        inserted: 0,
        skipped: 0,
        errors: ['Please upload a valid CSV or Excel file first']
      });
      return;
    }
    
    setImporting(true);
    setImportResult(null);
    
    try {
      if (importMode === 'replace') {
        console.log('🗑️ Deleting all existing master list records...');
        const { error: deleteError } = await supabase
          .from('graduates_master')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (deleteError) {
          throw new Error(`Delete failed: ${deleteError.message}`);
        }
        console.log('✅ Existing records deleted');
      }
      
      const batchSize = 100;
      let inserted = 0;
      let importErrors: string[] = [];
      
      console.log(`📥 Importing ${parsedRecords.length} records in batches of ${batchSize}...`);
      
      for (let i = 0; i < parsedRecords.length; i += batchSize) {
        const batch = parsedRecords.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(parsedRecords.length / batchSize)}...`);
        
        const { error: insertError } = await supabase
          .from('graduates_master')
          .upsert(batch, { 
            onConflict: 'student_id',
            ignoreDuplicates: importMode === 'append'
          });
        
        if (insertError) {
          importErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
          console.error(`❌ Batch failed:`, insertError);
        } else {
          inserted += batch.length;
          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} inserted: ${batch.length} records`);
        }
      }
      
      const result: ImportResult = {
        success: importErrors.length === 0,
        message: importErrors.length === 0 
          ? `Successfully imported ${inserted} records to graduates_master table` 
          : `Imported ${inserted} records with ${importErrors.length} errors`,
        inserted,
        skipped: parsedRecords.length - inserted,
        errors: importErrors
      };
      
      setImportResult(result);
      
      if (importErrors.length === 0) {
        setTimeout(() => {
          onImportComplete();
          resetModal();
          onClose();
        }, 2000);
      }
      
    } catch (error: any) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error.message || 'Import failed',
        inserted: 0,
        skipped: parsedRecords.length,
        errors: [error.message]
      });
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setPreviewData([]);
    setValidationErrors([]);
    setImportResult(null);
    setParsedRecords([]);
    setImportMode('append');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Master List</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload CSV or Excel file to add official graduate records for registration verification</p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">×</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive ? 'border-[#800000] bg-[#800000]/5' : 'border-gray-300 dark:border-gray-600 hover:border-[#800000]/50'}`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input id="file-input" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            <div className="text-5xl mb-3">📁</div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">{file ? file.name : 'Drag & drop or click to upload CSV or Excel file'}</p>
            <p className="text-xs text-gray-400 mt-2">Supported formats: CSV, Excel (.xlsx, .xls) | Required columns: student_id, full_name, email, course, batch_year</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">📋 <span className="font-semibold">Required columns:</span> student_id, full_name, email, course, batch_year</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">All columns are required. Email must be valid format. Batch year must be a number between 1900-2100.</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">✅ Data will be inserted into "graduates_master" table with verified = TRUE</p>
          </div>

          {previewData.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Import Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="w-4 h-4 text-[#800000]" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Append new records (skip duplicates by student_id)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="w-4 h-4 text-[#800000]" />
                  <span className="text-sm text-red-600 dark:text-red-400">Replace all existing data (⚠️ destructive - clears current master list)</span>
                </label>
              </div>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Preview (First {previewData.length} rows)</h3>
                <span className="text-xs text-gray-500">Total valid records: {parsedRecords.length}</span>
              </div>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {previewData.length > 0 && Object.keys(previewData[0] || {}).slice(0, 6).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {Object.values(row).slice(0, 6).map((val: any, i) => (
                          <td key={i} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{String(val).substring(0, 30)}{String(val).length > 30 ? '...' : ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">⚠️ Validation Errors ({validationErrors.length})</p>
              <div className="max-h-32 overflow-y-auto">
                {validationErrors.slice(0, 10).map((err, idx) => <p key={idx} className="text-xs text-red-600 dark:text-red-400">• {err}</p>)}
                {validationErrors.length > 10 && <p className="text-xs text-red-500 mt-1">+{validationErrors.length - 10} more errors</p>}
              </div>
            </div>
          )}

          {importResult && (
            <div className={`rounded-lg p-3 ${importResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <p className={`text-sm font-semibold ${importResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                {importResult.success ? '✅' : '❌'} {importResult.message}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Inserted: {importResult.inserted} | Skipped: {importResult.skipped}</p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto">
                  {importResult.errors.slice(0, 5).map((err, idx) => <p key={idx} className="text-xs text-red-600 dark:text-red-400">• {err}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button onClick={handleImport} disabled={parsedRecords.length === 0 || validationErrors.length > 0 || importing} className="flex-1 px-4 py-2 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-semibold rounded-lg hover:from-[#6a0000] hover:to-[#8a0000] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {importing ? <div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing to graduates_master...</div> : `Import ${parsedRecords.length} Records to Master List`}
          </button>
          <button onClick={handleClose} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">Cancel</button>
        </div>
      </div>
    </div>
  );
}