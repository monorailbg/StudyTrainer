// Reusable skeleton placeholders for content that loads asynchronously
// (cloud / IndexedDB). Mirrors the library card grid layout so the
// transition to real content is seamless.

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div>
      <div className="skeleton anim-rise" style={{ width: '120px', height: '12px', marginBottom: '18px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="anim-rise"
            style={{
              ['--d' as string]: `${i * 50}ms`,
              background: '#161B22', border: '1px solid #21262D',
              borderRadius: '16px', padding: '16px',
            }}
          >
            <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '75%', height: '12px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '45%', height: '10px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
