import { useEffect, useState } from 'react';

// A large screen driven by a mouse/trackpad, not screen width alone — this
// excludes tablets and phones held in landscape, and reacts live if a
// browser window is resized across the threshold.
const QUERY = '(min-width: 900px) and (pointer: fine)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  ));

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
