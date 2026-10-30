import { NavLink } from 'react-router-dom';
import { House, LayoutGrid, Settings, Sparkles, Target, type LucideIcon } from 'lucide-react';

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/sections', label: 'Sections', icon: LayoutGrid },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function TabBar() {
  return (
    <nav className="material-bar hairline fixed inset-x-0 bottom-0 z-40 border-t pb-safe" aria-label="Main">
      <ul className="mx-auto flex max-w-content" role="tablist">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              role="tab"
              className={({ isActive }) =>
                `flex h-[50px] flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium ${
                  isActive ? 'text-accent' : 'text-[rgb(var(--fill))]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.1 : 1.7} aria-hidden />
                  <span aria-current={isActive ? 'page' : undefined}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
