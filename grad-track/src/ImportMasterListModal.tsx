// src/ImportMasterListModal.tsx
import React, { useState, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { notifyMasterListImported } from './lib/notificationUtils';
import {
  parseExcelAllSheets,
  validateAndTransformData,
  getPreviewData,
  detectColumnMapping,
  detectFormatTypeWrapper,
  DEPARTMENT_MAPPING,
  type MasterListRecord,
  type ImportResult,
  type SheetData
} from './lib/importUtils';

interface ImportMasterListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  adminUserId?: string;
}

// Manual override a user can apply per-sheet when auto-detection didn't
// confidently resolve course/department/batch year.
interface SheetOverride {
  course?: string;
  department?: string;
  batchYear?: string;
}

const VALID_DEPARTMENTS = ['CCS', 'CTE', 'CCJE', 'CBE', 'PSY'];

export default function ImportMasterListModal({
  isOpen,
  onClose,
  onImportComplete,
  adminUserId
}: ImportMasterListModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRecords, setParsedRecords] = useState<MasterListRecord[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<'standard' | 'registrar' | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [importAll, setImportAll] = useState(false);
  const [alreadyImportedCount, setAlreadyImportedCount] = useState<number>(0);

  // Helper to query existing student IDs in database
  const fetchExistingStudentIds = async (studentIds: string[]): Promise<Set<string>> => {
    const existingSet = new Set<string>();
    if (!studentIds || studentIds.length === 0) return existingSet;

    const chunkSize = 300;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      const { data } = await supabase
        .from('graduates_master')
        .select('student_id')
        .in('student_id', chunk);

      if (data) {
        data.forEach((r: { student_id: string }) => existingSet.add(r.student_id));
      }
    }
    return existingSet;
  };

  // Per-sheet manual overrides, keyed by sheet index (stable for the
  // lifetime of a parsed file — sheets aren't reordered after parsing).
  const [sheetOverrides, setSheetOverrides] = useState<Record<number, SheetOverride>>({});

  // ============================================================
  // EFFECTIVE METADATA (auto-detected, with manual overrides applied)
  // ============================================================

  const getEffectiveMetadata = (index: number, sheetList: SheetData[] = sheets) => {
    const sheet = sheetList[index];
    const override = sheetOverrides[index] || {};
    return {
      course: (override.course ?? sheet?.course) || '',
      batchYear: (override.batchYear ?? sheet?.batchYear) || '',
      department: (override.department ?? sheet?.department) || '',
    };
  };

  // A sheet "needs review" if department couldn't be determined at all
  // (auto-detect empty) AND no manual override has been set yet.
  const sheetNeedsReview = (index: number, sheetList: SheetData[] = sheets) => {
    const meta = getEffectiveMetadata(index, sheetList);
    return !meta.department;
  };

  const sheetsNeedingReview = sheets
    .map((s, i) => ({ sheet: s, index: i }))
    .filter(({ index }) => sheetNeedsReview(index));

  // ============================================================
  // PROCESS FILE
  // ============================================================

  const processFile = async (selectedFile: File) => {
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(fileExt || '')) {
      setValidationErrors(['Please upload CSV or Excel files only.']);
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);
    setImportResult(null);
    setDetectedFormat(null);
    setColumnMapping({});
    setParsedRecords([]);
    setPreviewData([]);
    setSheetOverrides({});
    setLoadingSheets(true);

    try {
      // Parse all sheets
      const sheetInfos = await parseExcelAllSheets(selectedFile);

      if (sheetInfos.length === 0) {
        setValidationErrors(['No valid data found in the file.']);
        setLoadingSheets(false);
        return;
      }

      setSheets(sheetInfos);
      setSelectedSheetIndex(0);

      // Load the first sheet
      loadSheet(0, sheetInfos, {});

    } catch (error) {
      console.error('Parse error:', error);
      setValidationErrors(['Failed to parse file. Please check the format.']);
    } finally {
      setLoadingSheets(false);
    }
  };

  // ============================================================
  // LOAD / REVALIDATE A SPECIFIC SHEET
  // ============================================================

  const loadSheet = (
    index: number,
    sheetList: SheetData[] = sheets,
    overridesOverride: Record<number, SheetOverride> = sheetOverrides
  ) => {
    const sheet = sheetList[index];
    if (!sheet) return;

    setSelectedSheetIndex(index);
    setValidationErrors([]);

    // Detect column mapping
    const mapping = detectColumnMapping(sheet.headers);
    setColumnMapping(mapping);

    // Detect format type
    const formatType = detectFormatTypeWrapper(sheet.headers);
    setDetectedFormat(formatType);

    getEffectiveMetadata(index, sheetList);
    // (getEffectiveMetadata reads from sheetOverrides state directly; when
    // called synchronously right after setSheetOverrides, pass the fresh
    // object explicitly via overridesOverride to avoid stale state.)
    const override = overridesOverride[index] || {};
    const effectiveMetadata = {
      course: (override.course ?? sheet.course) || '',
      batchYear: (override.batchYear ?? sheet.batchYear) || '',
      department: (override.department ?? sheet.department) || '',
    };

    const { valid, errors } = validateAndTransformData(sheet.data, effectiveMetadata);

    if (errors.length > 0) {
      setValidationErrors(errors.slice(0, 10));
    }

    setParsedRecords(valid);
    setPreviewData(getPreviewData(valid));

    // Pre-check duplicate records already in database
    if (valid.length > 0) {
      fetchExistingStudentIds(valid.map(r => r.student_id)).then(existingSet => {
        const dupCount = valid.filter(r => existingSet.has(r.student_id)).length;
        setAlreadyImportedCount(dupCount);
      }).catch(() => setAlreadyImportedCount(0));
    } else {
      setAlreadyImportedCount(0);
    }

    if (valid.length === 0) {
      setValidationErrors(prev => [...prev, 'No valid records found in this sheet']);
    }
  };

  // ============================================================
  // MANUAL OVERRIDE HANDLERS
  // ============================================================

  const updateOverride = (index: number, patch: SheetOverride) => {
    setSheetOverrides(prev => {
      const currentOverride = prev[index] || {};
      const newPatch = { ...patch };

      // If user provided/changed course and department is not explicitly set yet:
      if (newPatch.course && !newPatch.department && !currentOverride.department) {
        const cLower = newPatch.course.trim().toLowerCase();
        let matchedDept = '';
        for (const [key, value] of Object.entries(DEPARTMENT_MAPPING)) {
          if (cLower.includes(key.toLowerCase()) || key.toLowerCase().includes(cLower)) {
            matchedDept = value;
            break;
          }
        }
        if (!matchedDept && /MAED|Master of Arts in Education|Education/i.test(newPatch.course)) {
          matchedDept = 'CTE';
        }
        if (matchedDept) {
          newPatch.department = matchedDept;
        }
      }

      const next = { ...prev, [index]: { ...currentOverride, ...newPatch } };
      // Re-run validation immediately with the fresh override so the
      // preview/records/errors reflect the change without an extra click.
      loadSheet(index, sheets, next);
      return next;
    });
  };

  // ============================================================
  // IMPORT ALL SHEETS
  // ============================================================

  const importAllSheets = async () => {
    if (sheetsNeedingReview.length > 0) {
      setImportResult({
        success: false,
        message: `${sheetsNeedingReview.length} sheet(s) still need a department set before importing all.`,
        inserted: 0,
        skipped: 0,
        errors: sheetsNeedingReview.map(({ sheet }) => `Sheet "${sheet.name}": department not set`)
      });
      return;
    }

    setImportAll(true);
    setImporting(true);
    setImportResult(null);

    let totalInserted = 0;
    let totalSkipped = 0;
    let allErrors: string[] = [];

    try {
      // Delete existing if replace mode
      if (importMode === 'replace') {
        const { error: deleteError } = await supabase
          .from('graduates_master')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          throw new Error(`Delete failed: ${deleteError.message}`);
        }
      }

      // Pre-fetch all existing student IDs if append mode
      let allStudentIds: string[] = [];
      for (const s of sheets) {
        allStudentIds.push(...s.data.map((r: any) => r.student_id).filter(Boolean));
      }

      const globalExistingSet = importMode === 'append'
        ? await fetchExistingStudentIds(allStudentIds)
        : new Set<string>();

      for (let sheetIdx = 0; sheetIdx < sheets.length; sheetIdx++) {
        const sheet = sheets[sheetIdx];
        const metadata = getEffectiveMetadata(sheetIdx);

        // Validate and transform with effective metadata
        const { valid, errors } = validateAndTransformData(sheet.data, metadata);

        if (valid.length === 0) {
          allErrors.push(`Sheet "${sheet.name}": No valid records found`);
          continue;
        }

        if (errors.length > 0) {
          allErrors.push(`Sheet "${sheet.name}": ${errors.length} validation errors`);
        }

        let sheetRecordsToInsert = valid;
        let sheetExistingCount = 0;

        if (importMode === 'append') {
          sheetExistingCount = valid.filter(r => globalExistingSet.has(r.student_id)).length;
          sheetRecordsToInsert = valid.filter(r => !globalExistingSet.has(r.student_id));

          if (sheetExistingCount === valid.length) {
            totalSkipped += valid.length;
            allErrors.push(`Sheet "${sheet.name}": Already imported (${valid.length} duplicate records skipped)`);
            continue;
          }
        }

        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < sheetRecordsToInsert.length; i += batchSize) {
          const batch = sheetRecordsToInsert.slice(i, i + batchSize);

          const { error: insertError } = await supabase
            .from('graduates_master')
            .upsert(batch, {
              onConflict: 'student_id',
              ignoreDuplicates: importMode === 'append'
            });

          if (insertError) {
            allErrors.push(`Sheet "${sheet.name}" batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
          } else {
            totalInserted += batch.length;
          }
        }
        totalSkipped += sheetExistingCount;
      }

      // ERROR HANDLER: If ALL records across ALL sheets were ALREADY imported!
      if (totalInserted === 0 && totalSkipped > 0 && importMode === 'append') {
        setImportResult({
          success: false,
          message: `⚠️ File / Batch Already Imported! All ${totalSkipped} records across ${sheets.length} sheet(s) are already present in the Master List database.`,
          inserted: 0,
          skipped: totalSkipped,
          errors: [
            `Duplicate Import Prevented: All student records in this file already exist in the database. Double entry was blocked.`
          ]
        });
        setImporting(false);
        setImportAll(false);
        return;
      }

      const result: ImportResult = {
        success: totalInserted > 0,
        message: totalInserted > 0
          ? `Successfully imported ${totalInserted} new records from ${sheets.length} sheets${totalSkipped > 0 ? ` (${totalSkipped} duplicates skipped)` : ''}`
          : `Import completed with warnings`,
        inserted: totalInserted,
        skipped: totalSkipped,
        errors: allErrors
      };

      setImportResult(result);

      if (adminUserId && totalInserted > 0) {
        await notifyMasterListImported(adminUserId, totalInserted);
      }

      if (totalInserted > 0 && allErrors.length === 0) {
        setTimeout(() => {
          onImportComplete();
          resetModal();
          onClose();
        }, 2000);
      }

    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || 'Import failed',
        inserted: 0,
        skipped: 0,
        errors: [error.message]
      });
    } finally {
      setImporting(false);
      setImportAll(false);
    }
  };

  // ============================================================
  // HANDLE DRAG AND DROP
  // ============================================================

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

  // ============================================================
  // HANDLE IMPORT (Single Sheet)
  // ============================================================

  const handleImport = async () => {
    if (parsedRecords.length === 0) {
      setImportResult({
        success: false,
        message: 'No valid records to import',
        inserted: 0,
        skipped: 0,
        errors: ['Please select a sheet with valid data']
      });
      return;
    }

    if (sheetNeedsReview(selectedSheetIndex)) {
      setImportResult({
        success: false,
        message: 'Please set a department for this sheet before importing.',
        inserted: 0,
        skipped: 0,
        errors: []
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      if (importMode === 'replace') {
        const { error: deleteError } = await supabase
          .from('graduates_master')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          throw new Error(`Delete failed: ${deleteError.message}`);
        }
      }

      let recordsToInsert = parsedRecords;
      let existingCount = 0;

      if (importMode === 'append') {
        const existingSet = await fetchExistingStudentIds(parsedRecords.map(r => r.student_id));
        existingCount = parsedRecords.filter(r => existingSet.has(r.student_id)).length;
        recordsToInsert = parsedRecords.filter(r => !existingSet.has(r.student_id));

        // ERROR HANDLER: If ALL records in this sheet/batch are ALREADY imported!
        if (existingCount === parsedRecords.length) {
          const currentMeta = getEffectiveMetadata(selectedSheetIndex);
          setImportResult({
            success: false,
            message: `⚠️ Batch Already Imported! All ${parsedRecords.length} records in "${currentMeta.course || sheets[selectedSheetIndex]?.name}" (${currentMeta.batchYear || 'N/A'}) already exist in the Master List database.`,
            inserted: 0,
            skipped: parsedRecords.length,
            errors: [
              `Duplicate Entry Error: All ${parsedRecords.length} records from this sheet are already saved in the database. Double entry was prevented.`
            ]
          });
          setImporting(false);
          return;
        }
      }

      const batchSize = 100;
      let inserted = 0;
      let importErrors: string[] = [];

      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);

        const { error: insertError } = await supabase
          .from('graduates_master')
          .upsert(batch, {
            onConflict: 'student_id',
            ignoreDuplicates: importMode === 'append'
          });

        if (insertError) {
          importErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        } else {
          inserted += batch.length;
        }
      }

      const totalSkipped = existingCount + (recordsToInsert.length - inserted);

      const result: ImportResult = {
        success: importErrors.length === 0 && inserted > 0,
        message: importErrors.length === 0
          ? `Successfully imported ${inserted} new records${existingCount > 0 ? ` (${existingCount} existing duplicates skipped to prevent double entry)` : ''}`
          : `Imported ${inserted} records with ${importErrors.length} errors`,
        inserted,
        skipped: totalSkipped,
        errors: importErrors
      };

      setImportResult(result);

      if (adminUserId && inserted > 0) {
        await notifyMasterListImported(adminUserId, inserted);
      }

      if (importErrors.length === 0 && inserted > 0) {
        setTimeout(() => {
          onImportComplete();
          resetModal();
          onClose();
        }, 2000);
      }

    } catch (error: any) {
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

  // ============================================================
  // RESET MODAL
  // ============================================================

  const resetModal = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheetIndex(0);
    setPreviewData([]);
    setValidationErrors([]);
    setImportResult(null);
    setParsedRecords([]);
    setImportMode('append');
    setDetectedFormat(null);
    setColumnMapping({});
    setImportAll(false);
    setSheetOverrides({});
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // ============================================================
  // HANDLE SHEET CHANGE
  // ============================================================

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value);
    loadSheet(index);
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!isOpen) return null;

  const hasMultipleSheets = sheets.length > 1;
  const currentSheet = sheets[selectedSheetIndex];
  const currentMetadata = currentSheet ? getEffectiveMetadata(selectedSheetIndex) : null;
  const currentNeedsReview = currentSheet ? sheetNeedsReview(selectedSheetIndex) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-100 dark:border-gray-700 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Master List</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Upload CSV or Excel file to add official graduate records
                {sheets.length > 0 && ` (${sheets.length} sheets found)`}
              </p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">×</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive ? 'border-[#800000] bg-[#800000]/5' : 'border-gray-300 dark:border-gray-600 hover:border-[#800000]/50'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input id="file-input" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            <div className="text-5xl mb-3">📁</div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              {file ? file.name : 'Drag & drop or click to upload CSV or Excel file'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supported formats: CSV, Excel (.xlsx, .xls) {sheets.length > 0 && `| ${sheets.length} sheets detected`}
            </p>
          </div>

          {/* Sheets Needing Review Banner */}
          {sheetsNeedingReview.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                ⚠️ {sheetsNeedingReview.length} sheet(s) need a department set before they can be imported
              </p>
              <div className="flex flex-wrap gap-2">
                {sheetsNeedingReview.map(({ sheet, index }) => (
                  <button
                    key={index}
                    onClick={() => loadSheet(index)}
                    className="text-xs px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                  >
                    {sheet.name} — fix now
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sheet Selector */}
          {sheets.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Select Sheet:
                </label>
                <select
                  value={selectedSheetIndex}
                  onChange={handleSheetChange}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm flex-1 min-w-[200px]"
                >
                  {sheets.map((sheet, index) => (
                    <option key={index} value={index}>
                      {sheetNeedsReview(index) ? '⚠️ ' : ''}
                      {sheet.name} ({sheet.rowCount} records)
                      {getEffectiveMetadata(index).course ? ` - ${getEffectiveMetadata(index).course}` : ''}
                      {getEffectiveMetadata(index).batchYear ? ` (${getEffectiveMetadata(index).batchYear})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  {sheets[selectedSheetIndex]?.rowCount || 0} records found
                </span>
              </div>
            </div>
          )}

          {/* Already Imported Batch Alert Banner */}
          {alreadyImportedCount > 0 && parsedRecords.length > 0 && importMode === 'append' && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              alreadyImportedCount === parsedRecords.length
                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'
                : 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
            }`}>
              <div className="text-2xl flex-shrink-0">
                {alreadyImportedCount === parsedRecords.length ? '🛑' : '⚠️'}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {alreadyImportedCount === parsedRecords.length
                    ? 'Batch Already Imported'
                    : 'Partial Duplicates Detected'}
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  {alreadyImportedCount === parsedRecords.length
                    ? `All ${parsedRecords.length} records in this sheet already exist in the Master List database. Double entry protection is active.`
                    : `${alreadyImportedCount} out of ${parsedRecords.length} records in this sheet already exist in the database and will be skipped to prevent double entry.`}
                </p>
              </div>
            </div>
          )}

          {/* Sheet Info + Manual Override */}
          {currentSheet && currentMetadata && (
            <div className={`rounded-lg p-4 border ${
              currentNeedsReview
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {currentNeedsReview ? '⚠️ Needs review — set the fields below' : '📚 Auto-detected — you can adjust if needed'}
                </p>
                <span className="text-xs text-gray-500">📊 {currentSheet.rowCount} records</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Course / Program & Major</label>
                  <input
                    type="text"
                    list="course-major-suggestions"
                    value={currentMetadata.course}
                    onChange={(e) => updateOverride(selectedSheetIndex, { course: e.target.value })}
                    placeholder="e.g. Bachelor of Secondary Education - English"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                  <datalist id="course-major-suggestions">
                    <option value="BS Information Technology" />
                    <option value="BS Computer Science" />
                    <option value="Bachelor of Elementary Education" />
                    <option value="Bachelor of Secondary Education - English" />
                    <option value="Bachelor of Secondary Education - Math" />
                    <option value="Bachelor of Secondary Education - Science" />
                    <option value="Bachelor of Secondary Education - Social Studies" />
                    <option value="Bachelor of Secondary Education - Filipino" />
                    <option value="Bachelor of Secondary Education - MAPEH" />
                    <option value="Bachelor of Secondary Education - Values Education" />
                    <option value="Bachelor of Secondary Education - TLE" />
                    <option value="Master of Arts in Education - Educational Management" />
                    <option value="Master of Arts in Education - Language Teaching" />
                    <option value="Master of Arts in Education - Mathematics" />
                    <option value="Master of Arts in Education - Guidance and Counseling" />
                    <option value="Master of Arts in Education - Physical Education" />
                    <option value="Master of Arts in Education - General Science" />
                    <option value="Master of Arts in Education - Social Studies" />
                    <option value="Master of Arts in Education - Early Childhood Education" />
                    <option value="Master of Arts in Education - Special Education" />
                    <option value="Master of Arts in Education - Administration and Supervision" />
                    <option value="Master of Arts in Education - Filipino" />
                    <option value="Master of Arts in Education - English" />
                    <option value="BS Criminology" />
                    <option value="BS Accountancy" />
                    <option value="BSBA Financial Management" />
                    <option value="BSBA Marketing Management" />
                    <option value="BSBA Human Resource Management" />
                    <option value="BSBA Operations Management" />
                    <option value="BS Hospitality Management" />
                    <option value="BS Tourism Management" />
                    <option value="BS Psychology" />
                    <option value="BS Social Work" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Department {currentNeedsReview && <span className="text-amber-600 dark:text-amber-400">(required)</span>}
                  </label>
                  <select
                    value={currentMetadata.department}
                    onChange={(e) => updateOverride(selectedSheetIndex, { department: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      currentNeedsReview ? 'border-amber-400 dark:border-amber-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">— Select —</option>
                    {VALID_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Batch Year</label>
                  <input
                    type="number"
                    value={currentMetadata.batchYear}
                    onChange={(e) => updateOverride(selectedSheetIndex, { batchYear: e.target.value })}
                    placeholder="e.g. 2026"
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Column Mapping */}
          {Object.keys(columnMapping).length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">📋 Column Mapping Detected</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(columnMapping).map(([field, header]) => (
                  <div key={field} className="text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{field}:</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-1">"{header}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Format Detection */}
          {detectedFormat && (
            <div className={`rounded-lg p-3 ${
              detectedFormat === 'registrar'
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              <p className="text-sm font-semibold">
                {detectedFormat === 'registrar' ? (
                  <span className="text-blue-800 dark:text-blue-300">📋 Detected: Registrar Enrollment Format</span>
                ) : (
                  <span className="text-green-800 dark:text-green-300">📋 Detected: Standard Master List Format</span>
                )}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {detectedFormat === 'registrar'
                  ? 'The file appears to be from the Registrar\'s enrollment list. Columns will be automatically mapped.'
                  : 'The file appears to be in standard format with columns: student_id, full_name, email, course, batch_year, department'}
              </p>
            </div>
          )}

          {/* Import Mode */}
          {sheets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Import Mode</label>
                <span className="text-xs text-gray-500">
                  Total valid records: {parsedRecords.length}
                  {hasMultipleSheets && ` across ${sheets.length} sheets`}
                </span>
              </div>
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

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Preview (First {Math.min(previewData.length, 5)} rows)</h3>
              </div>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      {previewData.length > 0 && Object.keys(previewData[0] || {}).slice(0, 8).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {previewData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {Object.values(row).slice(0, 8).map((val: any, i) => (
                          <td key={i} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{String(val).substring(0, 30)}{String(val).length > 30 ? '...' : ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 5 && (
                <p className="text-xs text-gray-400">Showing 5 of {previewData.length} records</p>
              )}
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">⚠️ Validation Errors ({validationErrors.length})</p>
              <div className="max-h-32 overflow-y-auto">
                {validationErrors.slice(0, 10).map((err, idx) => <p key={idx} className="text-xs text-red-600 dark:text-red-400">• {err}</p>)}
                {validationErrors.length > 10 && <p className="text-xs text-red-500 mt-1">+{validationErrors.length - 10} more errors</p>}
              </div>
            </div>
          )}

          {/* Import Result */}
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

          {/* No Data Message */}
          {sheets.length > 0 && previewData.length === 0 && validationErrors.length === 0 && !loadingSheets && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 dark:text-gray-400">No valid records found in this sheet</p>
              <p className="text-sm text-gray-400 mt-1">Try selecting a different sheet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-6 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-3">
          {/* Import All Button */}
          {sheets.length > 1 && (
            <button
              onClick={importAllSheets}
              disabled={importing || loadingSheets || sheets.length === 0 || sheetsNeedingReview.length > 0}
              title={sheetsNeedingReview.length > 0 ? 'Resolve the department for all flagged sheets first' : undefined}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing && importAll ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing All...
                </div>
              ) : (
                `📦 Import All ${sheets.length} Sheets`
              )}
            </button>
          )}

          {/* Import Single Sheet Button */}
          <button
            onClick={handleImport}
            disabled={parsedRecords.length === 0 || validationErrors.length > 0 || importing || loadingSheets || currentNeedsReview}
            title={currentNeedsReview ? 'Set a department for this sheet first' : undefined}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-semibold rounded-lg hover:from-[#6a0000] hover:to-[#8a0000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing && !importAll ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importing...
              </div>
            ) : loadingSheets ? (
              'Loading sheets...'
            ) : (
              `Import ${parsedRecords.length} Records to Master List`
            )}
          </button>

          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}