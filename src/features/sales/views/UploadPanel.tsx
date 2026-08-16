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
        <div>파싱 중…</div>
      ) : (
        <div>
          <strong>All Orders 리포트(.txt / TSV)</strong> 파일을 끌어다 놓거나 클릭해 선택하세요.
          <div className="muted" style={{ marginTop: 6 }}>
            여러 파일·여러 마켓 동시 업로드 가능. 데이터는 브라우저를 벗어나지 않습니다.
          </div>
        </div>
      )}
    </div>
  );
}
