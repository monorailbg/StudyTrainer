import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import { CloudStatusBadge } from './components/CloudStatusBadge';
import Home from './pages/Home';
import Flashcards from './pages/Flashcards';
import Notes from './pages/Notes';
import Quiz from './pages/Quiz';
import SubjectPage from './pages/SubjectPage';
import Generate from './pages/Generate';

// Route-split the heavier, less-frequently-visited pages — each pulls in a
// large dedicated dependency (react-flow/dagre for the graph pages,
// mermaid-adjacent mind-map rendering) that previously bundled into the
// single ~2MB main chunk every visitor downloaded regardless of whether
// they ever opened these pages.
const MindMapPage = lazy(() => import('./pages/MindMap'));
const Dictionary = lazy(() => import('./pages/Dictionary'));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraph'));
const PersonalKnowledgeGraph = lazy(() => import('./pages/PersonalKnowledgeGraph'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyPage = lazy(() => import('./pages/CompanyPage'));

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <div className="skeleton" style={{ width: '120px', height: '12px' }} />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/mindmap" element={<MindMapPage />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
          <Route path="/pkg" element={<PersonalKnowledgeGraph />} />
          <Route path="/subject/:id" element={<SubjectPage />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/company/:id" element={<CompanyPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function AppContent() {
  useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', background: 'var(--bg-page)', transition: 'background-color 0.3s ease, color 0.3s ease' }}>
      <Navbar />
      <AnimatedRoutes />
      <CloudStatusBadge />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
