// 랜딩페이지 — macOS 시스템 UI 스타일(승인된 정본 mockup-landing-APPROVED.html 이식).
// 단일 밝은 회색 배경, 솔리드 화이트 sticky 헤더, 히어로 헤드라인 + 브라우저 크롬 프레임
// 안에 실제 대시보드 미리보기(라운드스퀘어 그라디언트 아이콘 배지 + 플랫 2D 막대).
// 기능 4개는 넘버링 없이 한 줄 그리드. 요금제 섹션 없음(유료화 미착수).
// 표시 계층만(로직 없음). 진입 라우트(/)로, CTA를 눌러야 대시보드(/sales)로 들어간다.
import { Link, useNavigate } from 'react-router-dom';

const YEAR = new Date().getFullYear();

// 기능 4개 — 순서 아님(병렬). 넘버링 금지. 각 아이콘은 흰 stroke 라인아이콘(SVG).
interface Feature {
  key: string;
  name: string;
  desc: string;
  icon: JSX.Element;
}

const FEATURES: Feature[] = [
  {
    key: 'sales',
    name: '매출 대시보드',
    desc: '주문 리포트를 올리면 국가·품목·일별 매출과 KPI가 자동으로 계산됩니다.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 17l5-5 4 4 8-9" />
        <path d="M15 7h5v5" />
      </svg>
    ),
  },
  {
    key: 'ads',
    name: '광고 최적화',
    desc: 'SP 벌크 파일을 분석해 입찰가를 제안하고, 선택한 것만 반영해 재다운로드합니다.',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.6" fill="#fff" />
      </svg>
    ),
  },
  {
    key: 'inventory',
    name: '재고 계산기',
    desc: '미국은 FBA 2단(3PL↔FBA), 일본은 FBM 단일창고 — 언제 얼마나 보낼지 계산합니다.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </svg>
    ),
  },
  {
    key: 'pricing',
    name: '가격·마진',
    desc: '관세·물류·수수료까지 반영한 카테고리별 비용구조로 실제 마진을 확인합니다.',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 7h8" />
        <path d="M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0" />
      </svg>
    ),
  },
];

// 히어로 프레임 안 미니 차트(표시 전용 목업 축척) — 정본과 동일한 높이 배열.
const PREVIEW_BARS = [35, 52, 41, 28, 63, 71, 58, 80, 66, 22, 74, 90, 69, 55];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LandingPage() {
  const navigate = useNavigate();
  const start = () => navigate('/sales');

  return (
    <div className="landing">
      {/* 헤더 — 솔리드 화이트 sticky */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to="/" className="side-brand" aria-label="홈으로" style={{ padding: 0 }}>
            <span className="side-mark" aria-hidden="true" />
            <span className="lp-wordmark">Amazon 셀러 콘솔</span>
          </Link>
          <nav className="lp-nav" aria-label="주요 메뉴">
            <div className="lp-nav-links">
              <Link className="lp-nav-link" to="/sales">매출</Link>
              <Link className="lp-nav-link" to="/ads">광고</Link>
              <Link className="lp-nav-link" to="/inventory">재고</Link>
              <Link className="lp-nav-link" to="/pricing">가격·마진</Link>
            </div>
            <div className="lp-nav-cta">
              <button className="lp-btn lp-btn-outline" onClick={start}>로그인</button>
              <button className="lp-btn lp-btn-primary" onClick={start}>시작하기</button>
            </div>
          </nav>
        </div>
      </header>

      {/* 히어로 — 헤드라인 + 브라우저 프레임 안 대시보드 미리보기 */}
      <section className="lp-hero">
        <div className="landing-wrap">
          <span className="lp-eyebrow">
            <span className="lp-eyebrow-dot" aria-hidden="true" />
            아마존 셀러를 위한 운영 콘솔
          </span>
          <h1 className="lp-hero-title">
            매출·광고·재고·마진을
            <br />
            <span className="grad">한 화면</span>에서 관리하세요
          </h1>
          <p className="lp-hero-sub">
            미국(FBA)·일본(FBM) 두 마켓을 오가며 엑셀과 리포트를 뒤지지 마세요. 업로드 한 번이면 국가별
            매출, 광고 최적화, 재고 발주 시점, 마진까지 자동으로 계산됩니다.
          </p>
          <div className="lp-hero-cta">
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={start}>
              무료로 시작하기 →
            </button>
            <button className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollToId('features')}>
              기능 살펴보기
            </button>
          </div>

          <div className="lp-frame lp-frame-in" aria-hidden="true">
            <div className="lp-frame-bar">
              <span className="lp-dot" />
              <span className="lp-dot" />
              <span className="lp-dot" />
            </div>
            <div className="lp-frame-body">
              <div className="lp-mini-kpi">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 17l5-5 4 4 8-9" />
                    <path d="M15 7h5v5" />
                  </svg>
                </div>
                <div className="l">총 매출</div>
                <div className="v">$48,210</div>
              </div>
              <div className="lp-mini-kpi">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                    <path d="M3 8v8l9 5 9-5V8" />
                    <path d="M12 13v8" />
                  </svg>
                </div>
                <div className="l">주문 건수</div>
                <div className="v">1,204</div>
              </div>
              <div className="lp-mini-kpi">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8.5" />
                    <circle cx="12" cy="12" r="4.5" />
                    <circle cx="12" cy="12" r="0.6" fill="#fff" />
                  </svg>
                </div>
                <div className="l">평균 객단가</div>
                <div className="v">$40.05</div>
              </div>
              <div className="lp-mini-kpi">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 14l-5-5 5-5" />
                    <path d="M4 9h11a5 5 0 0 1 5 5v1" />
                  </svg>
                </div>
                <div className="l">환불율</div>
                <div className="v">1.8%</div>
              </div>
              <div className="lp-frame-chart">
                {PREVIEW_BARS.map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 4개 — 넘버링 없이 한 줄 그리드 */}
      <section className="lp-features" id="features">
        <div className="landing-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">기능</span>
            <h2>네 가지 도구, 하나의 콘솔</h2>
          </div>
          <div className="lp-feat-grid">
            {FEATURES.map((f) => (
              <div className="lp-feat" key={f.key}>
                <div className="ic" aria-hidden="true">
                  {f.icon}
                </div>
                <h3>{f.name}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 푸터 — 한 줄(요금제 없음, 지금은 무료) */}
      <footer className="lp-footer">
        © {YEAR} Amazon 셀러 콘솔 · 지금은 무료로 이용 가능합니다
      </footer>
    </div>
  );
}
