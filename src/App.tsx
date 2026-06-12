import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
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
import KnowledgeGraphPage from './pages/KnowledgeGraph';
import BlindSpots from './pages/BlindSpots';
import PersonalKnowledgeGraph from './pages/PersonalKnowledgeGraph';

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
        <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
        <Route path="/blind-spots" element={<BlindSpots />} />
        <Route path="/pkg" element={<PersonalKnowledgeGraph />} />
        <Route path="/subject/:id" element={<SubjectPage />} />
      </Routes>
    </div>
  );
}

function AppContent() {
  useTheme();

  return (
    <div style={{ transition: 'background-color 0.3s ease, color 0.3s ease' }}>
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
