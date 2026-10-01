import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import Header from './Header';
import BottomNav from './BottomNav';

/** Scroll to top on new navigations, but leave the position alone on back/forward. */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP') window.scrollTo({ top: 0 });
  }, [pathname, type]);
  return null;
};

const BackToTop: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-24 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-fg shadow-card hover:bg-surface-2 md:bottom-6"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
};

const AppLayout: React.FC = () => (
  <div className="min-h-screen">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
    >
      Skip to content
    </a>
    <ScrollToTop />
    <Header />
    {/* bottom padding clears the mobile navigation bar */}
    <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-8">
      <Outlet />
    </main>
    <BottomNav />
    <BackToTop />
  </div>
);

export default AppLayout;
