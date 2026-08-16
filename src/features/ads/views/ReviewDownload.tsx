// 변경 요약 + 벌크 파일 생성·다운로드 + S7(실제 업로드는 사용자 몫) 안내.
interface Props {
  bidChangeCount: number;
  newKeywordCount: number;
  negativeCount: number;
  onGenerate: () => void;
  busy?: boolean;
  error?: string | null;
}

export function ReviewDownload({
  bidChangeCount,
  newKeywordCount,
  negativeCount,
  onGenerate,
  busy,
  error,
}: Props) {
  const total = bidChangeCount + newKeywordCount + negativeCount;
  return (
    <div className="panel">
      <h2>벌크 파일 생성 · 다운로드</h2>
      <div className="kpi-grid" style={{ marginBottom: 10 }}>
        <div className="kpi-card">
          <div className="label">입찰 변경(update)</div>
          <div className="value">{bidChangeCount}</div>
        </div>
        <div className="kpi-card">
          <div className="label">신규 키워드(create)</div>
          <div className="value">{newKeywordCount}</div>
        </div>
        <div className="kpi-card">
          <div className="label">네거티브(create)</div>
          <div className="value">{negativeCount}</div>
        </div>
      </div>
      <button className="btn" disabled={busy || total === 0} onClick={onGenerate}>
        {busy ? '생성 중…' : `변경 ${total}건 반영한 벌크 xlsx 다운로드`}
      </button>
      {error && (
        <p className="badge danger" style={{ marginTop: 10, display: 'inline-block' }}>{error}</p>
      )}
      <p className="muted" style={{ fontSize: 'var(--fs-12)', marginTop: 12, lineHeight: 1.7 }}>
        원본 워크북을 그대로 두고 변경된 셀만 패치합니다(다른 시트·서식·성과 컬럼 100% 보존). 변경 행만
        <code> Operation=update</code>, 선택한 신규/네거티브만 <code>Operation=create</code>로 추가됩니다.
        <br />
        ⚠️ 최종 수용 검증(S7): 아마존 벌크 파서 규칙은 비공개입니다. 다운로드한 파일을 Seller Central에
        <strong> 소량(1~2행)만 시험 업로드</strong>해 "수락됨"을 직접 확인하세요(코드로는 완전검증 불가).
      </p>
    </div>
  );
}
