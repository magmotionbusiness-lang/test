import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { House, LayoutGrid, Settings, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { spring } from '@/app/motion';

const TABS: { to: string; label: string; icon: LucideIcon; featured?: boolean }[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/sections', label: 'Sections', icon: LayoutGrid },
  { to: '/insights', label: 'Insights', icon: Sparkles, featured: true },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function TabBar() {
  return (
    <nav className="material-bar hairline fixed inset-x-0 bottom-0 z-40 border-t pb-safe" aria-label="Main">
      <ul className="mx-auto flex max-w-content">
        {TABS.map(({ to, label, icon: Icon, featured }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-[50px] flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium ${
                  isActive ? 'text-accent' : 'text-secondary'
                } ${featured ? 'relative' : ''}`
              }
            >
              {({ isActive }) =>
                featured ? (
                  <>
                    {/* The data hub: a larger raised button that sits above the bar. */}
                    <motion.span
                      className="-mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-accent-fill text-white shadow-[0_4px_14px_rgb(var(--accent-fill)/0.45)] ring-4 ring-[rgb(var(--bg))]"
                      animate={{ scale: isActive ? 1.06 : 1 }}
                      whileTap={{ scale: 0.92 }}
                      transition={spring}
                      aria-hidden
                    >
                      <Icon size={26} strokeWidth={2.1} />
                    </motion.span>
                    <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                  </>
                ) : (
                  <>
                    <Icon size={24} strokeWidth={isActive ? 2.1 : 1.7} aria-hidden />
                    <span>{label}</span>
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
