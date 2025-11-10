'use client';

interface FileUploadSectionProps {
  file: File | null;
  loading: boolean;
  mode: 'ocr' | 'layout';
  onFileChange: (file: File | null) => void;
  onModeChange: (mode: 'ocr' | 'layout') => void;
  onUpload: () => void;
}

export function FileUploadSection({
  file,
  loading,
  mode,
  onFileChange,
  onModeChange,
  onUpload,
}: FileUploadSectionProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    onFileChange(selectedFile || null);
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-3 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Mode Selection */}
        <div className="inline-flex items-center rounded-md border">
          <button
            onClick={() => onModeChange('ocr')}
            className={`px-3 py-2 text-sm ${mode === 'ocr' ? 'bg-primary text-primary-foreground' : ''}`}
          >
            文字位置（OCR）
          </button>
          <button
            onClick={() => onModeChange('layout')}
            className={`px-3 py-2 text-sm border-l ${mode === 'layout' ? 'bg-primary text-primary-foreground' : ''}`}
          >
            レイアウト構造
          </button>
        </div>

        {/* File Upload */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-dashed rounded-md hover:bg-muted/50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm truncate">
              {file ? file.name : 'ファイルを選択...'}
            </span>
          </label>
        </div>

        {/* Execute Button */}
        <button
          onClick={onUpload}
          disabled={!file || loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25 stroke-current"
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75 fill-current"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              処理中...
            </span>
          ) : (
            '🚀 実行'
          )}
        </button>
      </div>
    </div>
  );
}

