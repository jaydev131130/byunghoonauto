declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
    directory?: string
  }
}

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ExtractionErrorType } from '../../types/extraction'
import { UPLOAD_CONSTRAINTS } from '../../types/extraction'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileDropZoneProps {
  onSubmit: (files: File[], problemSetName: string) => void
  disabled?: boolean
  errorType?: ExtractionErrorType | null
  onErrorClear?: () => void
}

type DropZoneState = 'idle' | 'dragover' | 'preview'

interface FileDisplayItem {
  file: File
  displayName: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function deduplicateFilenames(files: File[]): FileDisplayItem[] {
  const nameCount = new Map<string, number>()
  return files
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(file => {
      const count = nameCount.get(file.name) || 0
      nameCount.set(file.name, count + 1)
      const displayName =
        count > 0
          ? `${file.name.replace(/\.pdf$/i, '')} (${count}).pdf`
          : file.name
      return { file, displayName }
    })
}

function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

async function processDroppedItems(items: DataTransferItemList): Promise<{
  pdfFiles: File[]
  excluded: number
  folderName: string
}> {
  const pdfFiles: File[] = []
  let excluded = 0
  let folderName = ''

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const entry = item.webkitGetAsEntry?.()

    if (entry?.isDirectory) {
      folderName = entry.name
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const entries = await new Promise<FileSystemEntry[]>(resolve => {
        reader.readEntries(entries => resolve(entries))
      })
      for (const child of entries) {
        if (child.isFile) {
          if (isPdf(child.name)) {
            const file = await new Promise<File>(resolve => {
              ;(child as FileSystemFileEntry).file(resolve)
            })
            pdfFiles.push(file)
          } else {
            excluded++
          }
        }
        // Skip subdirectories (1 depth only)
      }
    } else if (entry?.isFile) {
      const file = item.getAsFile()
      if (file) {
        if (isPdf(file.name)) {
          pdfFiles.push(file)
        } else {
          excluded++
        }
      }
    }
  }

  return { pdfFiles, excluded, folderName }
}

function validateFiles(files: File[]): string {
  if (files.length === 0) return 'PDF 파일이 없습니다.'
  if (files.length > UPLOAD_CONSTRAINTS.MAX_FILE_COUNT)
    return `파일 수가 너무 많습니다 (최대 ${UPLOAD_CONSTRAINTS.MAX_FILE_COUNT}개).`

  let totalSize = 0
  for (const f of files) {
    if (f.size > UPLOAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES)
      return `${f.name} 파일이 너무 큽니다 (최대 100MB).`
    totalSize += f.size
  }
  if (totalSize > UPLOAD_CONSTRAINTS.MAX_TOTAL_SIZE_BYTES)
    return '전체 파일 크기가 너무 큽니다 (최대 500MB).'

  return ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileDropZone({
  onSubmit,
  disabled = false,
  errorType,
  onErrorClear,
}: FileDropZoneProps) {
  const [dropState, setDropState] = useState<DropZoneState>('idle')
  const [fileItems, setFileItems] = useState<FileDisplayItem[]>([])
  const [excludedCount, setExcludedCount] = useState(0)
  const [problemSetName, setProblemSetName] = useState('')
  const [nameAutoDetected, setNameAutoDetected] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Callback ref: sets webkitdirectory via DOM API every time the folder input mounts
  const folderInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.setAttribute('webkitdirectory', '')
      node.setAttribute('directory', '')
    }
  }, [])

  // ESC key to cancel dragover
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dropState === 'dragover') {
        setDropState('idle')
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [dropState])

  const applyFiles = useCallback(
    (pdfFiles: File[], excluded: number, folderName: string) => {
      const validationError = validateFiles(pdfFiles)
      if (validationError) {
        setInlineError(validationError)
        setDropState('idle')
        return
      }
      setInlineError('')
      setFileItems(deduplicateFilenames(pdfFiles))
      setExcludedCount(excluded)
      if (folderName) {
        setProblemSetName(folderName)
        setNameAutoDetected(true)
      } else {
        setNameAutoDetected(false)
      }
      setDropState('preview')
    },
    [],
  )

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDropState('dragover')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDropState('dragover')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the drop zone itself (not a child)
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setDropState('idle')
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled) return
    const { pdfFiles, excluded, folderName } = await processDroppedItems(
      e.dataTransfer.items,
    )
    applyFiles(pdfFiles, excluded, folderName)
  }

  // ── File Inputs ────────────────────────────────────────────────────────────

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList?.length) return

    const allFiles = Array.from(fileList)
    const pdfFiles = allFiles.filter(f => isPdf(f.name))
    const excluded = allFiles.length - pdfFiles.length

    const firstPath = allFiles[0]?.webkitRelativePath || ''
    const folderName = firstPath.split('/')[0] || ''

    applyFiles(pdfFiles, excluded, folderName)
    // Reset so same folder can be re-selected
    e.target.value = ''
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList?.length) return

    const allFiles = Array.from(fileList)
    const pdfFiles = allFiles.filter(f => isPdf(f.name))
    const excluded = allFiles.length - pdfFiles.length

    applyFiles(pdfFiles, excluded, '')
    e.target.value = ''
  }

  // ── Keyboard on drop zone (idle state) ────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  // ── Name input ─────────────────────────────────────────────────────────────

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.length > UPLOAD_CONSTRAINTS.MAX_NAME_LENGTH) return
    setProblemSetName(val)
    setNameAutoDetected(false)
    if (errorType === 'conflict') onErrorClear?.()
  }

  // ── Submit & Cancel ────────────────────────────────────────────────────────

  const handleImport = () => {
    const name = problemSetName.trim()
    if (!name || fileItems.length === 0) return
    onSubmit(
      fileItems.map(item => item.file),
      name,
    )
  }

  const handleCancel = () => {
    setDropState('idle')
    setFileItems([])
    setExcludedCount(0)
    setProblemSetName('')
    setNameAutoDetected(false)
    setInlineError('')
    onErrorClear?.()
  }

  // ── Progress percentage ────────────────────────────────────────────────────

  const nameLength = problemSetName.length
  const nameNearLimit = nameLength >= 90

  const canImport =
    problemSetName.trim().length >= UPLOAD_CONSTRAINTS.MIN_NAME_LENGTH &&
    fileItems.length > 0 &&
    !disabled

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* aria-live region */}
      <div aria-live="polite" className="sr-only">
        {dropState === 'preview' && `${fileItems.length}개 PDF 파일 선택됨`}
        {inlineError && inlineError}
      </div>

      {/* ── IDLE / DRAGOVER ─────────────────────────────────────────────── */}
      {dropState !== 'preview' && (
        <div
          ref={dropZoneRef}
          data-testid="file-drop-zone"
          role="group"
          tabIndex={disabled ? -1 : 0}
          aria-label="PDF 파일 또는 폴더를 드래그하거나 Enter 키를 눌러 선택하세요"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          className={[
            'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4',
            'transition-all duration-200 outline-none',
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : dropState === 'dragover'
                ? 'border-blue-500 bg-blue-50 scale-[1.01] cursor-copy'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50 cursor-pointer',
          ].join(' ')}
        >
          {/* Cloud icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-12 w-12 transition-colors duration-200 ${
              dropState === 'dragover' ? 'text-blue-500' : 'text-gray-400'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p
            className={`text-base font-medium transition-colors duration-200 ${
              dropState === 'dragover' ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            {dropState === 'dragover'
              ? '여기에 놓으세요'
              : 'PDF 파일 또는 폴더를 여기에 드래그하세요'}
          </p>

          {dropState !== 'dragover' && (
            <>
              <p className="text-sm text-gray-400">또는</p>
              <div className="flex gap-3">
                {/* Folder select — input inside label as transparent overlay = native click */}
                <label
                  data-testid="folder-select-btn"
                  className={[
                    'relative overflow-hidden px-4 py-2 text-sm font-medium rounded-lg border transition-colors select-none',
                    disabled
                      ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 cursor-pointer',
                  ].join(' ')}
                >
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    disabled={disabled}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFolderSelect}
                  />
                  폴더 선택
                </label>
                {/* File select — same pattern */}
                <label
                  data-testid="file-select-btn"
                  className={[
                    'relative overflow-hidden px-4 py-2 text-sm font-medium rounded-lg border transition-colors select-none',
                    disabled
                      ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 cursor-pointer',
                  ].join(' ')}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    disabled={disabled}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileSelect}
                  />
                  파일 선택
                </label>
              </div>
              <p className="text-xs text-gray-400">PDF 파일만 지원됩니다</p>
            </>
          )}
        </div>
      )}

      {/* Inline error (below drop zone, when idle) */}
      {dropState !== 'preview' && inlineError && (
        <p className="mt-2 text-sm text-red-600">{inlineError}</p>
      )}

      {/* ── PREVIEW ─────────────────────────────────────────────────────── */}
      {dropState === 'preview' && (
        <div data-testid="file-drop-zone" className="space-y-4">
          {/* Problem set name */}
          <div>
            <label
              htmlFor="problem-set-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              문제집 이름
              {nameAutoDetected && (
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  (자동 감지됨)
                </span>
              )}
            </label>
            <input
              id="problem-set-name"
              type="text"
              data-testid="problem-set-name-input"
              value={problemSetName}
              onChange={handleNameChange}
              maxLength={UPLOAD_CONSTRAINTS.MAX_NAME_LENGTH}
              disabled={disabled}
              className={[
                'w-full px-3 py-2 border rounded-lg text-sm transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'disabled:bg-gray-100 disabled:cursor-not-allowed',
                errorType === 'conflict'
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-gray-300',
              ].join(' ')}
              placeholder="예: 쎈B 1-1"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-red-600">
                {errorType === 'conflict' &&
                  '이미 존재하는 문제집 이름입니다'}
              </span>
              <span
                className={`text-xs ${nameNearLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}
              >
                {nameLength}/{UPLOAD_CONSTRAINTS.MAX_NAME_LENGTH}
              </span>
            </div>
          </div>

          {/* File list */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              선택된 파일{' '}
              <span className="text-gray-500">({fileItems.length}개)</span>
            </p>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {fileItems.map(({ file, displayName }) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                >
                  <span
                    className="text-sm text-gray-700 truncate flex-1 mr-3"
                    title={displayName}
                  >
                    📄 {displayName}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>
            {excludedCount > 0 && (
              <p className="mt-2 text-sm text-yellow-600">
                ⚠ {excludedCount}개 파일 제외됨 (PDF 아님)
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              data-testid="import-button"
              disabled={!canImport}
              onClick={handleImport}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
                         hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                         transition-colors"
            >
              가져오기
            </button>
            <button
              type="button"
              data-testid="cancel-button"
              disabled={disabled}
              onClick={handleCancel}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium
                         hover:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </>
  )
}
