import MindMap from '../components/MindMap';

// Full-viewport canvas. The navbar is 72px tall and sticky, so the map fills
// the remaining height with no page scroll of its own.
export default function MindMapPage() {
  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 76px)', overflow: 'hidden', background: 'var(--bg-page)' }}>
      <MindMap />
    </div>
  );
}
