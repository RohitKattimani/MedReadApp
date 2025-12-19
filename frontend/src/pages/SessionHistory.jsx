import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Activity, Home, ChevronRight, Clock, Target, 
  CheckCircle, Calendar, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SessionHistory({ user }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await axios.get("/sessions");
      setSessions(response.data);
    } catch (error) {
      toast.error("Failed to load session history");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "text-green-400 bg-green-500/10 border-green-500/30";
      case "in_progress": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
      case "paused": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      case "quit": return "text-pink-400 bg-pink-500/10 border-pink-500/30";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/30";
    }
  };

  const formatTime = (ms) => {
    if (!ms) return "0s";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-black grid-pattern">
      {/* Navigation */}
      <nav className="glass px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-cyan-400" />
            <span className="font-heading font-bold text-2xl tracking-wider text-cyan-50">
              MED<span className="text-cyan-400">READ</span>
            </span>
          </div>
          <Button 
            onClick={() => navigate("/dashboard")}
            data-testid="back-to-dashboard-btn"
            variant="ghost"
            className="text-cyan-400"
          >
            <Home className="w-5 h-5 mr-2" />
            Dashboard
          </Button>
        </div>
      </nav>

      <main className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 mb-2">
              Archive
            </p>
            <h1 className="font-heading font-bold text-3xl text-cyan-50">
              SESSION HISTORY
            </h1>
          </div>

          {sessions.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="font-heading text-xl text-slate-400 mb-2">No Sessions Yet</h3>
              <p className="text-slate-500 mb-6">Start your first reading session to see history here</p>
              <Button 
                onClick={() => navigate("/dashboard")}
                className="cyber-button"
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const accuracy = session.images_reviewed > 0 
                  ? Math.round((session.correct_count / session.images_reviewed) * 100)
                  : 0;
                
                const avgTime = session.images_reviewed > 0
                  ? Math.round(session.total_time_ms / session.images_reviewed)
                  : 0;

                return (
                  <div 
                    key={session.session_id}
                    className="glass-card p-6 hover:border-cyan-500/30 cursor-pointer transition-all stats-card"
                    onClick={() => session.status === "completed" && navigate(`/results/${session.session_id}`)}
                    data-testid={`session-${session.session_id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left - Status & Date */}
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded text-xs font-mono uppercase border ${getStatusColor(session.status)}`}>
                          {session.status.replace('_', ' ')}
                        </span>
                        <div>
                          <p className="font-mono text-sm text-slate-300">
                            {formatDateTime(session.started_at)}
                          </p>
                          <p className="font-mono text-xs text-slate-500">
                            ID: {session.session_id}
                          </p>
                        </div>
                      </div>

                      {/* Center - Stats */}
                      <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-green-400" />
                          <span className="font-mono text-lg text-green-400">{accuracy}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-cyan-400" />
                          <span className="font-mono text-sm text-slate-300">
                            {session.correct_count}/{session.images_reviewed}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-400" />
                          <span className="font-mono text-sm text-slate-300">
                            {formatTime(avgTime)} avg
                          </span>
                        </div>
                      </div>

                      {/* Right - Arrow */}
                      {session.status === "completed" && (
                        <ChevronRight className="w-5 h-5 text-slate-500 hidden md:block" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="font-mono text-xs text-slate-500">
            © Rohit Kattimani 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
