import { useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Opening a delivery or lender slides the new page in from the right, and
// coming back brings the previous one in from the left, so screens keep a
// sense of place. Moving between the main tabs just fades. The first page
// load doesn't animate. Reduced-motion collapses all of it (see styles.css).
type Direction = 'none' | 'forward' | 'back' | 'fade';

const depth = (path: string) => (/^\/(delivery|lenders|edit)\/.+/.test(path) || path === '/new' ? 1 : 0);

export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  const direction = useRef<Direction>('none');

  if (previous.current !== pathname) {
    const from = depth(previous.current);
    const to = depth(pathname);
    direction.current = to > from ? 'forward' : to < from ? 'back' : 'fade';
    previous.current = pathname;
  }

  return <div key={pathname} className={`page page-${direction.current}`}>{children}</div>;
}
