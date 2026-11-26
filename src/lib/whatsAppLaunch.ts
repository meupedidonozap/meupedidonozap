type Listenable = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type VisibleDoc = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;

/**
 * After a tap on a WhatsApp link the page leaves the foreground when WhatsApp really opens.
 * Calls onNotOpened when that never happens within the wait; returns a function that stops watching.
 */
export function watchWhatsAppLaunch(onNotOpened: () => void, ms = 4000, win: Listenable = window, doc: VisibleDoc = document) {
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    win.removeEventListener('blur', stop);
    win.removeEventListener('pagehide', stop);
    doc.removeEventListener('visibilitychange', hidden);
  };
  const hidden = () => { if (doc.visibilityState === 'hidden') stop(); };
  const timer = setTimeout(() => { stop(); onNotOpened(); }, ms);
  win.addEventListener('blur', stop);
  win.addEventListener('pagehide', stop);
  doc.addEventListener('visibilitychange', hidden);
  return stop;
}
