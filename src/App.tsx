import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import { CloudStatusBadge } from './components/CloudStatusBadge';
import { useDimMode } from './store/useDimMode';
import Home from './pages/Home';
import MindMapPage from './pages/MindMap';
import Flashcards from './pages/Flashcards';
import Notes from './pages/Notes';
import Quiz from './pages/Quiz';
import SubjectPage from './pages/SubjectPage';
import Generate from './pages/Generate';

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
        <Route path="/subject/:id" element={<SubjectPage />} />
      </Routes>
    </div>
  );
}

function DimBodyClass() {
  const { pathname } = useLocation();
  const dim = useDimMode(s => s.dim);
  const show = ['/notes', '/flashcards', '/quiz', '/subject/'].some(p => pathname.startsWith(p));

  useEffect(() => {
    document.body.classList.toggle('app-dim-active', dim && show);
    return () => { document.body.classList.remove('app-dim-active'); };
  }, [dim, show]);

  return null;
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <BrowserRouter>
          <Navbar />
          <AnimatedRoutes />
          <DimBodyClass />
          <CloudStatusBadge />
        </BrowserRouter>
      </ToastProvider>
    </LanguageProvider>
  );
}
