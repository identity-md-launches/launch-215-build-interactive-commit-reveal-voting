export type IconName = 'arrow' | 'lock' | 'eye' | 'check' | 'reset' | 'play' | 'clock' | 'info' | 'garden' | 'book' | 'bike' | 'chevron' | 'x' | 'code';
const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.5" /></>,
  garden: <><path d="M12 21V11M12 16C4 17 3 12 3 8c6 0 9 2 9 8ZM12 12c0-6 3-9 9-9 0 6-3 9-9 9Z" /></>,
  book: <><path d="M12 6v15M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Z" /></>,
  bike: <><circle cx="5" cy="16" r="4" /><circle cx="19" cy="16" r="4" /><path d="m5 16 5-9 5 9H5M8 7h5M16 4h3l-4 12" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  x: <path d="m6 6 12 12M6 18 18 6" />,
  code: <><path d="m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16" /></>,
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
