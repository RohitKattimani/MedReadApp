import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Activity, LogOut, Upload, Play, History, FolderPlus, 
  Image as ImageIcon, Trash2, Plus, X, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ categories: [], total: 0 });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [customCategoryModalOpen, setCustomCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("cancer");
  const [customCategory, setCustomCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sessionCount, setSessionCount] = useState(20);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        axios.get("/images/stats"),
        axios.get("/sessions")
      ]);
      setStats(statsRes.data);
      setSessions(sessionsRes.data.slice(0, 5)); // Last 5 sessions
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local storage
      localStorage.removeItem('user');
      localStorage.removeItem('session_token');
      navigate("/", { replace: true });
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    const category = selectedCategory === "custom" ? customCategory : selectedCategory;
    if (!category) {
      toast.error("Please select or enter a category");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      try {
        await axios.post("/images/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error("Upload error:", error);
      }
    }

    setUploading(false);
    setUploadModalOpen(false);
    setCustomCategoryModalOpen(false);
    setCustomCategory("");
    fileInputRef.current.value = "";
    
    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} image(s) successfully`);
      fetchData();
    }
    if (errorCount > 0) {
      toast.error(`Failed to upload ${errorCount} image(s)`);
    }
  };

  const handleStartSession = async () => {
    if (stats.total === 0) {
      toast.error("No images available. Please upload images first.");
      return;
    }

    try {
      const response = await axios.post("/sessions/start", {
        image_count: Math.min(sessionCount, stats.total)
      });
      navigate(`/session/${response.data.session.session_id}`, {
        state: { session: response.data.session, images: response.data.images }
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start session");
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case "cancer": return "text-pink-400 bg-pink-500/10 border-pink-500/30";
      case "normal": return "text-green-400 bg-green-500/10 border-green-500/30";
      case "benign": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      default: return "text-purple-400 bg-purple-500/10 border-purple-500/30";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "text-green-400";
      case "in_progress": return "text-cyan-400";
      case "paused": return "text-yellow-400";
      case "quit": return "text-pink-400";
      default: return "text-slate-400";
    }
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
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-cyan-400" />
            <span className="font-heading font-bold text-2xl tracking-wider text-cyan-50">
              MED<span className="text-cyan-400">READ</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleStartSession}
              data-testid="quick-start-session-btn"
              className="cyber-button-success hidden sm:flex items-center gap-2"
              disabled={stats.total === 0}
            >
              <Play className="w-4 h-4" />
              <span>New Session</span>
            </Button>
            <div className="flex items-center gap-3">
              <img 
                src={user?.picture || "https://via.placeholder.com/40"} 
                alt={user?.name}
                className="w-10 h-10 rounded-full border-2 border-cyan-500/50"
              />
              <span className="font-mono text-sm text-cyan-100 hidden sm:block">
                {user?.name}
              </span>
            </div>
            <Button 
              onClick={handleLogout}
              data-testid="logout-btn"
              variant="ghost"
              className="text-slate-400 hover:text-pink-400"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome */}
          <div className="mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-500 mb-2">
              Dashboard
            </p>
            <h1 className="font-heading font-bold text-3xl text-cyan-50">
              Welcome back, <span className="text-cyan-400">{user?.name?.split(' ')[0]}</span>
            </h1>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Stats & Actions */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Actions */}
              <div className="glass-card p-6">
                <h2 className="font-heading font-medium text-lg text-cyan-100 mb-6">
                  Quick Actions
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleStartSession}
                    data-testid="start-session-btn"
                    className="cyber-button-success h-auto py-6 flex flex-col items-center gap-3"
                    disabled={stats.total === 0}
                  >
                    <Play className="w-8 h-8" />
                    <span>Start Reading Session</span>
                    <span className="text-xs opacity-70">
                      {stats.total} images available
                    </span>
                  </Button>
                  
                  <Button 
                    onClick={() => setUploadModalOpen(true)}
                    data-testid="upload-images-btn"
                    className="cyber-button h-auto py-6 flex flex-col items-center gap-3"
                  >
                    <Upload className="w-8 h-8" />
                    <span>Upload Images</span>
                    <span className="text-xs opacity-70">
                      JPEG, PNG, WEBP
                    </span>
                  </Button>
                </div>

                {/* Session Count Selector */}
                <div className="mt-6 flex items-center gap-4">
                  <span className="font-mono text-sm text-slate-400">Images per session:</span>
                  <Select value={sessionCount.toString()} onValueChange={(v) => setSessionCount(parseInt(v))}>
                    <SelectTrigger className="w-24 cyber-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-cyber-gray border-white/10">
                      {[10, 20, 30, 50, 100].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Image Categories */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading font-medium text-lg text-cyan-100">
                    Image Library
                  </h2>
                  <span className="font-mono text-sm text-cyan-400">
                    {stats.total} total
                  </span>
                </div>
                
                {stats.categories.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No images uploaded yet</p>
                    <Button 
                      onClick={() => setUploadModalOpen(true)}
                      className="mt-4 cyber-button"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Upload Your First Images
                    </Button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {stats.categories.map((cat) => (
                      <div 
                        key={cat.category}
                        className={`p-4 rounded border ${getCategoryColor(cat.category)} stats-card`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm uppercase tracking-wide">
                            {cat.category}
                          </span>
                          <span className="font-mono text-2xl font-bold">
                            {cat.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Recent Sessions */}
            <div className="space-y-8">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading font-medium text-lg text-cyan-100">
                    Recent Sessions
                  </h2>
                  <Button 
                    onClick={() => navigate("/history")}
                    data-testid="view-history-btn"
                    variant="ghost"
                    className="text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No sessions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => {
                      const accuracy = session.images_reviewed > 0 
                        ? Math.round((session.correct_count / session.images_reviewed) * 100)
                        : 0;
                      
                      return (
                        <div 
                          key={session.session_id}
                          onClick={() => session.status === "completed" && navigate(`/results/${session.session_id}`)}
                          className="p-4 bg-black/30 rounded border border-white/5 hover:border-cyan-500/30 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-mono text-xs uppercase ${getStatusColor(session.status)}`}>
                              {session.status}
                            </span>
                            <span className="font-mono text-xs text-slate-500">
                              {new Date(session.started_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">
                              {session.images_reviewed}/{session.total_images} images
                            </span>
                            <span className="font-mono text-sm text-cyan-400">
                              {accuracy}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="bg-cyber-gray border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-cyan-100">Upload Images</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a category and upload medical images
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div>
              <label className="font-mono text-xs text-cyan-500 uppercase tracking-wide mb-2 block">
                Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="cyber-input w-full" data-testid="category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-cyber-gray border-white/10">
                  <SelectItem value="cancer">Cancer</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="benign">Benign</SelectItem>
                  <SelectItem value="custom">Custom Category...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedCategory === "custom" && (
              <div>
                <label className="font-mono text-xs text-cyan-500 uppercase tracking-wide mb-2 block">
                  Custom Category Name
                </label>
                <Input 
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g., cyst, benign, polyp"
                  className="cyber-input"
                  data-testid="custom-category-input"
                />
              </div>
            )}

            <div>
              <label className="font-mono text-xs text-cyan-500 uppercase tracking-wide mb-2 block">
                Select Files
              </label>
              <input 
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleUpload}
                className="hidden"
                data-testid="file-input"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="cyber-button w-full"
                disabled={uploading || (selectedCategory === "custom" && !customCategory)}
                data-testid="select-files-btn"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Select Images
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
