// 라우팅·레이아웃. MVP는 매출 대시보드만 구현. /ads·/inventory는 로드맵 자리(§16).
import type { ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SalesDashboard } from '../features/sales/views/SalesDashboard';

function RoadmapPlaceholder({ title }: { title: string }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <p className="muted">로드맵 기능입니다. MVP 범위가 아니라 아직 구현되지 않았습니다.</p>
    </div>
  );
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Amazon 매출 대시보드</h1>
        <nav className="app-nav">
          <NavLink to="/sales" className={({ isActive }) => (isActive ? 'active' : '')}>
            매출
          </NavLink>
          <NavLink to="/ads" className={({ isActive }) => (isActive ? 'active' : '')}>
            광고(로드맵)
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => (isActive ? 'active' : '')}>
            재고(로드맵)
          </NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/sales" replace />} />
          <Route path="/sales" element={<SalesDashboard />} />
          <Route path="/ads" element={<RoadmapPlaceholder title="광고 최적화" />} />
          <Route path="/inventory" element={<RoadmapPlaceholder title="재고 계산기" />} />
          <Route path="*" element={<Navigate to="/sales" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
