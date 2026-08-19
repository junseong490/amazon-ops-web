// 라우팅·레이아웃. 진입점은 랜딩(/), CTA로 대시보드(/sales)에 들어간다.
// 대시보드 4화면(/sales·/ads·/inventory·/pricing)은 공통 셸(Layout)로 감싼다.
import type { ReactNode } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from '../features/landing/LandingPage';
import { SalesDashboard } from '../features/sales/views/SalesDashboard';
import { AdsWorkspace } from '../features/ads/views/AdsWorkspace';
import { InventoryCalculator } from '../features/inventory/views/InventoryCalculator';
import { PricingSimulator } from '../features/pricing/views/PricingSimulator';
import { ListingAudit } from '../features/listing/views/ListingAudit';

interface NavItem {
  to: string;
  label: string;
  badge?: string;
}

const NAV: NavItem[] = [
  { to: '/sales', label: '매출' },
  { to: '/ads', label: '광고' },
  { to: '/inventory', label: '재고' },
  { to: '/pricing', label: '가격·마진' },
  { to: '/listing', label: '리스팅 진단' },
];

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="command-shell">
      {/* 상단 가로 커맨드바 — Seller Command Deck 톤(밝은 서류면 + 보라 그라디언트 액센트) */}
      <header className="command-header">
        <Link to="/" className="command-brand" aria-label="홈으로">
          <span className="side-mark" aria-hidden="true">
            A
          </span>
          Amazon 셀러 콘솔
        </Link>
        <nav className="command-nav" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'command-nav-item active' : 'command-nav-item'
              }
            >
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>
        {/* 우측: 무기능 장식(알림 점·프로필) 대신, 앱이 실제로 지키는 사실만 배지로 노출 */}
        <div className="command-header-actions">
          <span className="analyst-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            데이터는 브라우저를 벗어나지 않습니다
          </span>
        </div>
      </header>
      <main className="command-main">
        <div className="route-view">{children}</div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 진입점: 랜딩(공통 셸 밖 — 자체 헤더/푸터) */}
        <Route path="/" element={<LandingPage />} />
        {/* 대시보드 4화면: 공통 셸(Layout)로 감쌈 */}
        <Route path="/sales" element={<Layout><SalesDashboard /></Layout>} />
        <Route path="/ads" element={<Layout><AdsWorkspace /></Layout>} />
        <Route path="/inventory" element={<Layout><InventoryCalculator /></Layout>} />
        <Route path="/pricing" element={<Layout><PricingSimulator /></Layout>} />
        <Route path="/listing" element={<Layout><ListingAudit /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
