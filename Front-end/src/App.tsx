import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { getStoredUser, isAdminUser } from './api';
import Login from './Login';
import Signup from './Signup';
import Dashboard from './Dashboard';
import Profile from './Profile';
import Admin from './Admin';
import DocumentEditor from './DocumentEditor';
import ModalProvider from './modal';
import './App.css';

const DocumentWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  if (!id) return null;
  return (
    <DocumentEditor
      id={id}
      onExit={() => navigate(isAdminUser(storedUser) ? '/admin' : '/dashboard')}
    />
  );
};

const HomeRedirect: React.FC = () => {
  const storedUser = getStoredUser();
  if (!storedUser) return <Navigate to="/login" replace />;
  return <Navigate to={isAdminUser(storedUser) ? '/admin' : '/dashboard'} replace />;
};

function App() {
  return (
    <ModalProvider>
    <Router>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/document/:id" element={<DocumentWrapper />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Router>
    </ModalProvider>
  );
}

export default App;
