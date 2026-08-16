// 광고 Bulk(.xlsx) 업로드 — 원본 바이트 보관(왕복용). 매출(TSV)과 별도 리더.
import { useCallback, useRef, useState } from 'react';

interface Props {
  onFile: (name: string, bytes: Uint8Array) => void;
  busy?: boolean;
}

export function AdsUpload({ onFile, busy }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (fl: FileList | File[]) => {
      const f = Array.from(fl)[0];
      if (!f) return;
      const bytes = new Uint8Array(await f.arrayBuffer());
      onFile(f.name, bytes);
    },
    [onFile],
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
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) void handle(e.target.files);
          e.target.value = '';
        }}
      />
      {busy ? (
        <div className="dz-busy">
          <span className="spinner" aria-hidden="true" />
          벌크 파일 파싱 중…
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
            <strong>Sponsored Products Bulk Operations(.xlsx)</strong>를 끌어다 놓거나 클릭해 선택
          </div>
          <div className="dz-sub">
            영문 헤더 SP 벌크 파일. 데이터는 브라우저를 벗어나지 않습니다.
          </div>
        </>
      )}
    </div>
  );
}
