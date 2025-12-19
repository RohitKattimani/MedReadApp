import { useEffect, useState, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

// Pages
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import ReadingSession from "@/pages/ReadingSession";
import Results from "@/pages/Results";
import SessionHistory from "@/pages/SessionHistory";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Configure axios defaults
axios.defaults.baseURL = `${BACKEND_URL}/api`;
axios.defaults.withCredentials = true;

// Add auth token interceptor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Callback Component
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        
        try {
          const response = await axios.post("/auth/session", { session_id: sessionId });
          // Store session token for API calls
          if (response.data.session_token) {
            localStorage.setItem('session_token', response.data.session_token);
          }
          // Store user in localStorage for persistence (without token)
          const userData = { ...response.data };
          delete userData.session_token;
          localStorage.setItem('user', JSON.stringify(userData));
          // Navigate to dashboard with user data
          navigate("/dashboard", { state: { user: userData }, replace: true });
        } catch (error) {
          console.error("Auth error:", error);
          navigate("/", { replace: true });
        }
      } else {
        navigate("/", { replace: true });
      }
    };

    processAuth();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-cyber-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-cyan-400 font-mono">AUTHENTICATING...</p>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const [user, setUser] = useState(location.state?.user || null);
  const hasChecked = useRef(false);

  useEffect(() => {
    // If user was passed from AuthCallback, we're authenticated
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }

    // Check localStorage first
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        return;
      } catch (e) {
        // Invalid stored user, continue to auth check
      }
    }

    // Prevent duplicate checks
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkAuth = async () => {
      try {
        const response = await axios.get("/auth/me");
        setUser(response.data);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch (error) {
        console.log("Auth check failed:", error.response?.status);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
        localStorage.removeItem('session_token');
        navigate("/", { replace: true });
      }
    };

    checkAuth();
  }, [location.state, navigate]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 font-mono">LOADING...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children({ user, setUser });
};

// App Router with session_id detection
const AppRouter = () => {
  const location = useLocation();

  // Check for session_id in URL fragment SYNCHRONOUSLY during render
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {({ user }) => <Dashboard user={user} />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/session/:sessionId" 
        element={
          <ProtectedRoute>
            {({ user }) => <ReadingSession user={user} />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/results/:sessionId" 
        element={
          <ProtectedRoute>
            {({ user }) => <Results user={user} />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/history" 
        element={
          <ProtectedRoute>
            {({ user }) => <SessionHistory user={user} />}
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <div className="scanlines vignette">
      <BrowserRouter>
        <AppRouter />
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(10, 10, 10, 0.9)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              color: '#e2e8f0',
              fontFamily: 'JetBrains Mono, monospace',
            },
          }}
        />
      </BrowserRouter>
    </div>
  );
}

export default App;
