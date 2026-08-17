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
    <div className="app-shell">
      {/* 좌측 고정 사이드바 — macOS 시스템 설정 스타일(밝은 회색, 다크 아님) */}
      <aside className="app-sidebar">
        <Link to="/" className="side-brand" aria-label="홈으로">
          <span className="side-mark" aria-hidden="true" />
          Amazon 셀러 콘솔
        </Link>
        <nav className="side-nav" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'side-navitem active' : 'side-navitem')}
            >
              <span className="dot" aria-hidden="true" />
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-section">워크스페이스</div>
        <p className="side-foot">데이터는 브라우저를 벗어나지 않습니다.</p>
      </aside>
      <main className="app-main">
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
