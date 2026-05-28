import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Flashcards from './pages/Flashcards';
import Notes from './pages/Notes';
import Quiz from './pages/Quiz';
import SubjectPage from './pages/SubjectPage';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/subject/:id" element={<SubjectPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
