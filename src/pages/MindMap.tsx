import MindMap from '../components/MindMap';

// Full-viewport canvas. The navbar is sticky, so the map fills the
// remaining height (--nav-height, from index.css) with no page scroll of
// its own.
export default function MindMapPage() {
  return (
    <div style={{ position: 'relative', height: 'calc(100vh - var(--nav-height))', overflow: 'hidden', background: 'var(--bg-page)' }}>
      <MindMap />
    </div>
  );
}
