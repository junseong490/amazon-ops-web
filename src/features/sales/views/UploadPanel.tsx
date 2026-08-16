// 업로드 UI. TSV(.txt) 우선, .csv/.tsv 허용(LOCKED §1). 여러 파일 동시 업로드(마켓 섞여도 됨).
import { useCallback, useRef, useState } from 'react';
import type { RawFile } from '../parse/pipeline';

interface Props {
  onFiles: (files: RawFile[]) => void;
  busy?: boolean;
}

async function toRawFiles(fileList: FileList | File[]): Promise<RawFile[]> {
  const files = Array.from(fileList);
  return Promise.all(
    files.map(async (f) => ({
      name: f.name,
      bytes: new Uint8Array(await f.arrayBuffer()),
    })),
  );
}

export function UploadPanel({ onFiles, busy }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (fl: FileList | File[]) => {
      const raw = await toRawFiles(fl);
      if (raw.length > 0) onFiles(raw);
    },
    [onFiles],
  );

  return (
    <div
      className={`dropzone${drag ? ' drag' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files) void handle(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.tsv,.csv,text/tab-separated-values,text/plain"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) void handle(e.target.files);
          e.target.value = '';
        }}
      />
      {busy ? (
        <div className="dz-busy">
          <span className="spinner" aria-hidden="true" />
          리포트 파싱 중…
        </div>
      ) : (
        <>
          <div className="dz-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="M8 8l4-4 4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </div>
          <div className="dz-title">
            <strong>All Orders 리포트(.txt / TSV)</strong>를 끌어다 놓거나 클릭해 선택
          </div>
          <div className="dz-sub">
            여러 파일·여러 마켓 동시 업로드 가능. 데이터는 브라우저를 벗어나지 않습니다.
          </div>
        </>
      )}
    </div>
  );
}
