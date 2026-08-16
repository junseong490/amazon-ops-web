// 라우팅·레이아웃. 3기능(/sales·/ads·/inventory)을 하나의 프레임으로.
// /sales·/inventory 실동작, /ads는 준비중(골격) 배지 표시(plan §4).
import type { ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SalesDashboard } from '../features/sales/views/SalesDashboard';
import { AdsWorkspace } from '../features/ads/views/AdsWorkspace';
import { InventoryCalculator } from '../features/inventory/views/InventoryCalculator';

interface NavItem {
  to: string;
  label: string;
  badge?: string;
}

const NAV: NavItem[] = [
  { to: '/sales', label: '매출' },
  { to: '/ads', label: '광고', badge: '준비중' },
  { to: '/inventory', label: '재고' },
];

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div className="brand-text">
            <h1>Amazon 셀러 운영 콘솔</h1>
            <span className="tag">매출 · 광고 · 재고 — 다국가 셀러 운영 보조</span>
          </div>
        </div>
        <nav className="app-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
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
          <Route path="/ads" element={<AdsWorkspace />} />
          <Route path="/inventory" element={<InventoryCalculator />} />
          <Route path="*" element={<Navigate to="/sales" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
