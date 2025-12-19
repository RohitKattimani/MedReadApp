import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Activity, Download, Home, RotateCcw, Clock, Target, 
  CheckCircle, XCircle, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, Legend 
} from "recharts";

export default function Results({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  const fetchResults = async () => {
    try {
      const response = await axios.get(`/sessions/${sessionId}`);
      setSession(response.data.session);
      setResponses(response.data.responses);
    } catch (error) {
      toast.error("Failed to load results");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const response = await axios.get(`/sessions/${sessionId}/csv`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `session_${sessionId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("CSV downloaded successfully");
    } catch (error) {
      toast.error("Failed to download CSV");
    }
  };

  const startNewSession = async () => {
    try {
      const response = await axios.post("/sessions/start", {
        image_count: 20
      });
      navigate(`/session/${response.data.session.session_id}`, {
        state: { session: response.data.session, images: response.data.images }
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start session");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <p className="text-slate-400">Session not found</p>
      </div>
    );
  }

  // Calculate stats
  const accuracy = session.images_reviewed > 0 
    ? Math.round((session.correct_count / session.images_reviewed) * 100)
    : 0;
  
  const avgTime = session.images_reviewed > 0
    ? Math.round(session.total_time_ms / session.images_reviewed)
    : 0;

  // Prepare chart data
  const pieData = [
    { name: 'Correct', value: session.correct_count, color: '#00ff9f' },
    { name: 'Incorrect', value: session.images_reviewed - session.correct_count, color: '#ff003c' }
  ];

  // Group responses by category
  const categoryStats = responses.reduce((acc, r) => {
    if (!acc[r.actual_category]) {
      acc[r.actual_category] = { total: 0, correct: 0 };
    }
    acc[r.actual_category].total++;
    if (r.is_correct) acc[r.actual_category].correct++;
    return acc;
  }, {});

  const barData = Object.entries(categoryStats).map(([category, stats]) => ({
    category: category.charAt(0).toUpperCase() + category.slice(1),
    accuracy: Math.round((stats.correct / stats.total) * 100),
    total: stats.total
  }));

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 mb-2">
              Session Complete
            </p>
            <h1 className="font-heading font-bold text-4xl text-cyan-50 mb-4">
              SESSION RESULTS
            </h1>
            <p className="font-mono text-sm text-slate-500">
              {new Date(session.started_at).toLocaleDateString()} at {new Date(session.started_at).toLocaleTimeString()}
            </p>
          </div>

          {/* Main Stats */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="glass-card p-6 text-center stats-card neon-box-green">
              <Target className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <p className="font-mono text-4xl text-green-400 font-bold">{accuracy}%</p>
              <p className="text-sm text-slate-400 mt-1">Accuracy</p>
            </div>
            
            <div className="glass-card p-6 text-center stats-card neon-box">
              <CheckCircle className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <p className="font-mono text-4xl text-cyan-400 font-bold">{session.correct_count}</p>
              <p className="text-sm text-slate-400 mt-1">Correct</p>
            </div>
            
            <div className="glass-card p-6 text-center stats-card neon-box-pink">
              <XCircle className="w-8 h-8 text-pink-400 mx-auto mb-3" />
              <p className="font-mono text-4xl text-pink-400 font-bold">
                {session.images_reviewed - session.correct_count}
              </p>
              <p className="text-sm text-slate-400 mt-1">Incorrect</p>
            </div>
            
            <div className="glass-card p-6 text-center stats-card">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <p className="font-mono text-4xl text-yellow-400 font-bold">{formatTime(avgTime)}</p>
              <p className="text-sm text-slate-400 mt-1">Avg Time</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Pie Chart */}
            <div className="glass-card p-6">
              <h3 className="font-heading font-medium text-lg text-cyan-100 mb-6">
                Overall Performance
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(10, 10, 10, 0.95)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        borderRadius: '4px',
                        color: '#e2e8f0'
                      }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#00f0ff' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="glass-card p-6">
              <h3 className="font-heading font-medium text-lg text-cyan-100 mb-6">
                Accuracy by Category
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis 
                      dataKey="category" 
                      stroke="#64748b"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#64748b"
                      fontSize={12}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(10, 10, 10, 0.95)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        borderRadius: '4px',
                        color: '#e2e8f0'
                      }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#00f0ff' }}
                      formatter={(value) => [`${value}%`, 'Accuracy']}
                    />
                    <Bar dataKey="accuracy" fill="#00f0ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Response Details */}
          <div className="glass-card p-6 mb-12">
            <h3 className="font-heading font-medium text-lg text-cyan-100 mb-6">
              Detailed Responses
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 font-mono text-xs text-cyan-500 uppercase">#</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-cyan-500 uppercase">Image ID</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-cyan-500 uppercase">Your Diagnosis</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-cyan-500 uppercase">Actual</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-cyan-500 uppercase">Result</th>
                    <th className="text-left py-3 px-4 font-mono text-xs text-cyan-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response, index) => (
                    <tr key={response.response_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 font-mono text-sm text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 font-mono text-sm text-slate-300">{response.image_id}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${
                          response.user_diagnosis === 'cancer' ? 'badge-cancer' :
                          response.user_diagnosis === 'normal' ? 'badge-normal' :
                          response.user_diagnosis === 'benign' ? 'badge-benign' : 'badge-custom'
                        }`}>
                          {response.user_diagnosis}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${
                          response.actual_category === 'cancer' ? 'badge-cancer' :
                          response.actual_category === 'normal' ? 'badge-normal' :
                          response.actual_category === 'benign' ? 'badge-benign' : 'badge-custom'
                        }`}>
                          {response.actual_category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {response.is_correct ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-pink-400" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-slate-400">
                        {formatTime(response.time_taken_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleDownloadCSV}
              data-testid="download-csv-btn"
              className="cyber-button"
            >
              <Download className="w-5 h-5 mr-2" />
              Download CSV Report
            </Button>
            
            <Button 
              onClick={startNewSession}
              data-testid="start-new-session-btn"
              className="cyber-button-success"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Start New Session
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer py-6 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="font-mono text-xs text-slate-500">
            © Rohit Kattimani 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
