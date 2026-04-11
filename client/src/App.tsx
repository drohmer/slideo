import { Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme';
import { AuthProvider } from './auth';
import { Home } from './components/Home';
import { Editor } from './components/Editor/Editor';
import { Presenter } from './components/Presenter/Presenter';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <I18nProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/edit/:id" element={<Editor />} />
            <Route path="/present/:id" element={<Presenter />} />
          </Routes>
        </I18nProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
