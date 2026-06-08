import { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import { CloudStatusBadge } from './components/CloudStatusBadge';
import Home from './pages/Home';
import MindMapPage from './pages/MindMap';
import Flashcards from './pages/Flashcards';
import Notes from './pages/Notes';
import Quiz from './pages/Quiz';
import SubjectPage from './pages/SubjectPage';
import Generate from './pages/Generate';
import Dictionary from './pages/Dictionary';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '32px', textAlign: 'center', gap: '16px',
        }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '18px', color: '#E6EDF3' }}>
            Something went wrong
          </div>
          <pre style={{
            maxWidth: '600px', fontSize: '11px', color: '#f87171', background: '#161B22',
            border: '1px solid #30363D', borderRadius: '8px', padding: '12px 16px',
            textAlign: 'left', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
            style={{
              padding: '8px 20px', borderRadius: '999px', background: '#3D7EFF18',
              color: '#3D7EFF', border: '1px solid #3D7EFF40', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Go to dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/mindmap" element={<MindMapPage />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/generate" element={<Generate />} />
        <Route path="/dictionary" element={<Dictionary />} />
        <Route path="/subject/:id" element={<SubjectPage />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <BrowserRouter>
          <Navbar />
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
          <CloudStatusBadge />
        </BrowserRouter>
      </ToastProvider>
    </LanguageProvider>
  );
}
