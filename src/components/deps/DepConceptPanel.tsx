import { useDependencies } from '../../store/useDependencies';
import { CATEGORY_COLORS } from '../../data/conceptGraph';
import { buildLearningPath, getAllPrereqs, getAllUnlocks } from '../../lib/depAlgorithms';
import type { EnrichedConcept } from '../../lib/depAlgorithms';

interface Props {
  concepts: EnrichedConcept[];
}

export default function DepConceptPanel({ concepts }: Props) {
  const { selectedConceptId, clearSelection, setMastery, getMastery } = useDependencies();

  const concept = selectedConceptId
    ? concepts.find((c) => c.id === selectedConceptId)
    : null;

  if (!concept) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-3)' }}>
        <svg viewBox="0 0 24 24" width={32} height={32} fill="none">
          <path d="M12 3L2 7l10 4 10-4-10-4zM2 17l10 4 10-4M2 12l10 4 10-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 180 }}>Click any node on the graph to inspect it</p>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[concept.category] ?? '#6B7280';
  const prereqConcepts = concept.prerequisites.map((id) => concepts.find((c) => c.id === id)).filter(Boolean) as EnrichedConcept[];
  const unlockConcepts = concept.unlockIds.map((id) => concepts.find((c) => c.id === id)).filter(Boolean) as EnrichedConcept[];
  const learningPath = buildLearningPath(concept.id, getMastery);

  const masteryColor =
    concept.masteryScore >= 80 ? '#10B981'
    : concept.masteryScore >= 40 ? '#F59E0B'
    : concept.masteryScore > 0 ? '#EF4444'
    : '#4B5563';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto', fontSize: 13 }}>
      {/* Back */}
      <button
        onClick={clearSelection}
        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, width: 'fit-content', fontSize: 11 }}
      >
        ← Back
      </button>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor }} />
          <span style={{ fontSize: 10, color: catColor, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {concept.category}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize' }}>
            {concept.difficulty}
          </span>
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text-1)', margin: '0 0 8px' }}>
          {concept.name}
        </h2>
        <p style={{ color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>{concept.description}</p>
      </div>

      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ScoreCard label="Mastery" value={concept.masteryScore} color={masteryColor} />
        <ScoreCard
          label="Readiness"
          value={concept.readinessScore}
          color={concept.readinessScore >= 60 ? '#3B82F6' : '#F97316'}
        />
      </div>

      {/* Mastery slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text-3)' }}>
          <span>Set mastery</span>
          <span style={{ color: masteryColor, fontWeight: 700 }}>{Math.round(concept.masteryScore)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={concept.masteryScore}
          onChange={(e) => setMastery(concept.id, Number(e.target.value))}
          style={{ width: '100%', accentColor: catColor, cursor: 'pointer' }}
        />
      </div>

      {/* Prerequisites */}
      {prereqConcepts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Prerequisites ({prereqConcepts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prereqConcepts.map((p) => (
              <ConceptChip key={p.id} concept={p} />
            ))}
          </div>
        </div>
      )}

      {/* Unlocks */}
      {unlockConcepts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Unlocks ({unlockConcepts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unlockConcepts.map((u) => (
              <ConceptChip key={u.id} concept={u} />
            ))}
          </div>
        </div>
      )}

      {/* Learning path to reach this */}
      {learningPath.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Path to master ({learningPath.length} steps)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {learningPath.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, background: 'var(--bg-elevated)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)', width: 14 }}>{i + 1}</span>
                <span style={{ color: 'var(--text-2)', fontSize: 12, flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 10, color: CATEGORY_COLORS[c.category] ?? '#6B7280' }}>{c.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: color + '14', border: `1px solid ${color}28` }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'Sora', sans-serif" }}>
        {Math.round(value)}
      </div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, marginTop: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 1, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function ConceptChip({ concept }: { concept: EnrichedConcept }) {
  const color =
    concept.masteryScore >= 80 ? '#10B981'
    : concept.masteryScore >= 40 ? '#F59E0B'
    : concept.masteryScore > 0 ? '#EF4444'
    : '#4B5563';

  const { selectConcept } = useDependencies();

  return (
    <button
      onClick={() => selectConcept(concept.id, getAllPrereqs(concept.id), getAllUnlocks(concept.id))}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '6px 10px', borderRadius: 8, background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{concept.name}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{Math.round(concept.masteryScore)}%</span>
    </button>
  );
}
