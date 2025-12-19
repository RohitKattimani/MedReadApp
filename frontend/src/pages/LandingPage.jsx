import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Activity, Shield, Zap, Eye, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const response = await axios.get("/auth/me");
        if (response.data) {
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        // Not authenticated, stay on landing page
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-bg grid-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-cyan-400" />
            <span className="font-heading font-bold text-2xl tracking-wider text-cyan-50">
              MED<span className="text-cyan-400">READ</span>
            </span>
          </div>
          <Button 
            onClick={handleLogin}
            data-testid="nav-login-btn"
            className="cyber-button"
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-500">
                  Advanced Medical Image Analysis
                </p>
                <h1 className="font-heading font-bold text-5xl lg:text-6xl tracking-wider leading-tight">
                  <span className="gradient-text">PRECISION</span>
                  <br />
                  <span className="text-cyan-50">DIAGNOSTICS</span>
                </h1>
                <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                  Train your diagnostic eye with randomized medical image sessions. 
                  Track your accuracy, measure your speed, and improve your clinical skills.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={handleLogin}
                  data-testid="hero-login-btn"
                  className="cyber-button text-lg py-6 px-8"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Get Started with Google
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Secured with Google Authentication
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
                <div>
                  <p className="font-mono text-2xl text-cyan-400 neon-text">100%</p>
                  <p className="text-sm text-slate-500 mt-1">Secure</p>
                </div>
                <div>
                  <p className="font-mono text-2xl text-cyan-400 neon-text">Fast</p>
                  <p className="text-sm text-slate-500 mt-1">Loading</p>
                </div>
                <div>
                  <p className="font-mono text-2xl text-cyan-400 neon-text">Precise</p>
                  <p className="text-sm text-slate-500 mt-1">Tracking</p>
                </div>
              </div>
            </div>

            {/* Right - Visual */}
            <div className="relative">
              <div className="glass-card p-8 relative overflow-hidden">
                <img 
                  src="https://images.pexels.com/photos/8395815/pexels-photo-8395815.jpeg"
                  alt="Medical Analysis"
                  className="w-full h-80 object-cover rounded opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="font-mono text-sm text-green-400">SYSTEM READY</span>
                  </div>
                  <p className="font-mono text-xs text-slate-400">
                    Real-time diagnostic analysis platform
                  </p>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 glass-card p-4 neon-box flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-400" />
                <span className="text-xs text-cyan-400 font-mono">Analysis</span>
              </div>
              <div className="absolute -bottom-4 -left-4 glass-card p-4 neon-box-pink flex items-center gap-2">
                <Zap className="w-5 h-5 text-pink-400" />
                <span className="text-xs text-pink-400 font-mono">Speed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 mb-4">
              Features
            </p>
            <h2 className="font-heading font-semibold text-3xl text-cyan-50">
              DIAGNOSTIC TOOLKIT
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-card p-8 space-y-4 stats-card">
              <div className="w-12 h-12 rounded bg-cyan-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="font-heading font-medium text-xl text-cyan-100">
                Random Sessions
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Images are randomized for unbiased training. Pre-cached loading ensures instant display.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card p-8 space-y-4 stats-card">
              <div className="w-12 h-12 rounded bg-pink-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="font-heading font-medium text-xl text-cyan-100">
                Time Tracking
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Precise timing per diagnosis. Custom input time excluded from measurements.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-8 space-y-4 stats-card">
              <div className="w-12 h-12 rounded bg-green-500/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-heading font-medium text-xl text-cyan-100">
                Analytics
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Detailed session results with accuracy metrics. Export to CSV for records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            <span className="font-heading font-bold text-lg tracking-wider text-cyan-50">
              MED<span className="text-cyan-400">READ</span>
            </span>
          </div>
          <p className="font-mono text-xs text-slate-500">
            © Rohit Kattimani 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
