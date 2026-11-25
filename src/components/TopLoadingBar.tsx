import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

/** Discreet progress line while DiColore data is still loading; never blocks the screen. */
export default function TopLoadingBar() {
  const { pathname } = useLocation();
  const busy = useIsFetching() + useIsMutating() > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Short waits stay invisible to avoid flicker.
    const timer = setTimeout(() => setVisible(busy), busy ? 200 : 150);
    return () => clearTimeout(timer);
  }, [busy]);
  if (pathname.split('/')[1] !== 'dicolore' || !visible) return null;
  return (
    <div role="progressbar" aria-label="Carregando informações" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/20">
      <div className="h-full w-1/3 rounded-full bg-primary animate-top-loading" />
    </div>
  );
}
