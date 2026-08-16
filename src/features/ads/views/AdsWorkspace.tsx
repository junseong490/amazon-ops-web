// 광고 최적화 — 골격만(brief B). 업로드 수신 확인 + "샘플 필요" 안내까지.
// 파싱/CPC/키워드 로직은 넣지 않는다(실제 Bulk Operations 스키마 미확정, LOCKED).
import { useState } from 'react';
import { UploadPanel } from '../../sales/views/UploadPanel';
import type { RawFile } from '../../sales/parse/pipeline';

interface Received {
  name: string;
  /** 바이트 크기 (KB 표시용) */
  bytes: number;
}

function formatKb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function AdsWorkspace() {
  const [received, setReceived] = useState<Received[]>([]);

  // 수신 확인만 한다 — 스키마 미확정이라 파싱/집계는 하지 않는다.
  function handleFiles(files: RawFile[]) {
    setReceived((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, bytes: f.bytes.length })),
    ]);
  }

  return (
    <>
      <div className="panel">
        <h2>
          광고 벌크 업로드
          <span className="gross-note">· 준비중(골격)</span>
        </h2>
        <UploadPanel onFiles={handleFiles} />
        {received.length > 0 && (
          <div className="loaded-bar">
            <span className="muted">{received.length}개 파일 수신됨(확인용)</span>
            <button className="btn" onClick={() => setReceived([])}>
              초기화
            </button>
          </div>
        )}
        {received.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th className="col-name">파일명</th>
                  <th>크기</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {received.map((f, i) => (
                  <tr key={`${f.name}#${i}`}>
                    <td className="col-name">{f.name}</td>
                    <td>{formatKb(f.bytes)}</td>
                    <td>
                      <span className="badge warn">파싱 대기</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>이 기능은 아직 준비중입니다</h2>
        <div className="empty">
          <div className="empty-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>
          <div className="empty-title">실제 Bulk Operations 샘플 파일이 필요합니다</div>
          <div className="empty-sub">
            샘플 벌크 파일(Sponsored Products 등 다중 시트 xlsx)을 받는 즉시 키워드 효율·권장 CPC
            산출·원본 포맷 벌크 재생성을 구현합니다. 스키마가 확정되지 않아 지금은 파일 수신
            확인까지만 제공합니다(가짜 지표를 만들지 않습니다). 업로드한 파일은 브라우저를 벗어나지
            않습니다.
          </div>
        </div>
        <ul className="muted" style={{ fontSize: 'var(--fs-13)', lineHeight: 1.8, marginTop: 4 }}>
          <li>남은 작업 — 벌크 스키마 매핑(core/schema 확장)</li>
          <li>남은 작업 — 지표·권장 CPC 순수 계산 함수 + 테스트</li>
          <li>남은 작업 — 원본 포맷 보존 재생성(SheetJS CE 쓰기 정합성 검증)</li>
        </ul>
      </div>
    </>
  );
}
