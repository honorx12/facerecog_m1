import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import Nav from './components/Nav';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Enroll from './pages/Enroll';
import Verify from './pages/Verify';
import Roster from './pages/Roster';
import Log from './pages/Log';
import Login from './pages/Login';
import Config from './pages/Config';
import Terms from './pages/Terms';

export default function App() {
  return (
    <AuthProvider>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/enroll" element={<Enroll />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/log" element={<Log />} />
        <Route path="/login" element={<Login />} />
        <Route path="/config" element={<Config />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
      <Footer />
    </AuthProvider>
  );
}
