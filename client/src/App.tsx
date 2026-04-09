import { Routes, Route } from 'react-router-dom';
import { Home } from './components/Home';
import { Editor } from './components/Editor/Editor';
import { Presenter } from './components/Presenter/Presenter';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/edit/:id" element={<Editor />} />
      <Route path="/present/:id" element={<Presenter />} />
    </Routes>
  );
}
