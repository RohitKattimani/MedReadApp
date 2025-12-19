import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Activity, Pause, Play, ChevronLeft, ChevronRight, 
  X, Clock, CheckCircle, XCircle, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

export default function ReadingSession({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [session, setSession] = useState(location.state?.session || null);
  const [images, setImages] = useState(location.state?.images || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [customDiagnosis, setCustomDiagnosis] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [loading, setLoading] = useState(!location.state);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [preloadedImage, setPreloadedImage] = useState(null);
  
  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const customInputStartRef = useRef(null);
  const customInputTimeRef = useRef(0);

  // Pre-cache next image
  useEffect(() => {
    if (images.length > 0 && currentIndex < images.length - 1) {
      const nextImage = images[currentIndex + 1];
      if (nextImage?.image_data) {
        const img = new Image();
        img.src = nextImage.image_data;
        setPreloadedImage(img);
      }
    }
  }, [currentIndex, images]);

  // Fetch session data if not passed
  useEffect(() => {
    if (!location.state?.session) {
      fetchSessionData();
    }
  }, [sessionId]);

  // Timer logic
  useEffect(() => {
    if (!isPaused && !showCustomInput && images.length > 0) {
      startTimeRef.current = Date.now() - elapsedTime;
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 100);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, showCustomInput, currentIndex]);

  // Track custom input time
  useEffect(() => {
    if (showCustomInput) {
      customInputStartRef.current = Date.now();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } else if (customInputStartRef.current) {
      customInputTimeRef.current += Date.now() - customInputStartRef.current;
      customInputStartRef.current = null;
    }
  }, [showCustomInput]);

  const fetchSessionData = async () => {
    try {
      const response = await axios.get(`/sessions/${sessionId}`);
      setSession(response.data.session);
      
      // Get random images for this session
      const imagesRes = await axios.get("/images/random", {
        params: { count: response.data.session.total_images }
      });
      setImages(imagesRes.data);
    } catch (error) {
      toast.error("Failed to load session");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const submitDiagnosis = async (diagnosis) => {
    if (submitting) return;
    
    setSubmitting(true);
    const currentImage = images[currentIndex];
    
    // Calculate time (subtract custom input time)
    const timeTaken = elapsedTime - customInputTimeRef.current;
    
    try {
      const response = await axios.post(`/sessions/${sessionId}/response`, {
        image_id: currentImage.image_id,
        diagnosis: diagnosis,
        time_taken_ms: timeTaken
      });
      
      setLastResult({
        isCorrect: response.data.is_correct,
        actual: response.data.actual_category,
        userDiagnosis: diagnosis
      });
      
      // Wait a moment to show result
      setTimeout(() => {
        moveToNext();
      }, 1000);
      
    } catch (error) {
      toast.error("Failed to submit diagnosis");
    } finally {
      setSubmitting(false);
    }
  };

  const moveToNext = () => {
    setLastResult(null);
    setShowCustomInput(false);
    setCustomDiagnosis("");
    customInputTimeRef.current = 0;
    setElapsedTime(0);
    
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Session complete
      completeSession();
    }
  };

  const moveToPrevious = () => {
    if (currentIndex > 0) {
      setLastResult(null);
      setShowCustomInput(false);
      setCustomDiagnosis("");
      customInputTimeRef.current = 0;
      setElapsedTime(0);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const completeSession = async () => {
    try {
      await axios.post(`/sessions/${sessionId}/complete`);
      navigate(`/results/${sessionId}`);
    } catch (error) {
      toast.error("Failed to complete session");
    }
  };

  const handlePause = async () => {
    if (isPaused) {
      try {
        await axios.post(`/sessions/${sessionId}/resume`);
        setIsPaused(false);
        toast.success("Session resumed");
      } catch (error) {
        toast.error("Failed to resume session");
      }
    } else {
      try {
        await axios.post(`/sessions/${sessionId}/pause`);
        setIsPaused(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        toast.success("Session paused");
      } catch (error) {
        toast.error("Failed to pause session");
      }
    }
  };

  const handleQuit = async () => {
    try {
      await axios.post(`/sessions/${sessionId}/quit`);
      navigate("/dashboard");
    } catch (error) {
      toast.error("Failed to quit session");
    }
  };

  const handleCustomSubmit = () => {
    if (customDiagnosis.trim()) {
      submitDiagnosis(customDiagnosis.trim().toLowerCase());
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${tenths}`;
    }
    return `${seconds}.${tenths}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 font-mono">LOADING SESSION...</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];
  const progress = ((currentIndex + 1) / images.length) * 100;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="glass px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Activity className="w-6 h-6 text-cyan-400" />
          <span className="font-heading font-bold text-lg tracking-wider text-cyan-50">
            MED<span className="text-cyan-400">READ</span>
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-400">
              {currentIndex + 1} / {images.length}
            </span>
            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Timer */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className={`font-mono text-lg timer-display ${elapsedTime > 30000 ? 'text-yellow-400' : 'text-cyan-400'}`}>
              {formatTime(elapsedTime)}
            </span>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button 
              onClick={handlePause}
              data-testid="pause-btn"
              variant="ghost"
              className={`${isPaused ? 'text-green-400' : 'text-yellow-400'}`}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </Button>
            <Button 
              onClick={() => setShowQuitDialog(true)}
              data-testid="quit-btn"
              variant="ghost"
              className="text-pink-400"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid lg:grid-cols-[1fr_350px] overflow-hidden">
        {/* Image Viewer */}
        <div className="image-viewer flex items-center justify-center p-4 relative">
          {isPaused ? (
            <div className="text-center">
              <Pause className="w-24 h-24 text-yellow-400 mx-auto mb-4 opacity-50" />
              <p className="font-heading text-2xl text-yellow-400">SESSION PAUSED</p>
              <p className="font-mono text-sm text-slate-500 mt-2">Click play to resume</p>
            </div>
          ) : currentImage ? (
            <>
              <img 
                src={currentImage.image_data || currentImage.thumbnail_url}
                alt="Medical Image"
                className="max-w-full max-h-full object-contain fade-in"
                data-testid="current-image"
              />
              
              {/* Result Overlay */}
              {lastResult && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className={`text-center p-8 rounded-lg ${lastResult.isCorrect ? 'bg-green-500/20 border border-green-500/50' : 'bg-pink-500/20 border border-pink-500/50'}`}>
                    {lastResult.isCorrect ? (
                      <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
                    ) : (
                      <XCircle className="w-20 h-20 text-pink-400 mx-auto mb-4" />
                    )}
                    <p className={`font-heading text-2xl ${lastResult.isCorrect ? 'text-green-400' : 'text-pink-400'}`}>
                      {lastResult.isCorrect ? 'CORRECT' : 'INCORRECT'}
                    </p>
                    <p className="font-mono text-sm text-slate-400 mt-2">
                      Actual: <span className="text-cyan-400">{lastResult.actual}</span>
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500">No image available</p>
          )}
          
          {/* Navigation arrows */}
          {currentIndex > 0 && !isPaused && (
            <Button 
              onClick={moveToPrevious}
              data-testid="prev-image-btn"
              className="absolute left-4 top-1/2 -translate-y-1/2 cyber-button p-3"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
        </div>

        {/* Diagnosis Panel */}
        <div className="glass-card flex flex-col p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Image Info */}
            <div>
              <p className="font-mono text-xs text-cyan-500 uppercase tracking-wide mb-2">
                Image ID
              </p>
              <p className="font-mono text-sm text-slate-300">
                {currentImage?.image_id || 'N/A'}
              </p>
            </div>

            {/* Diagnosis Buttons */}
            <div className="space-y-4">
              <p className="font-mono text-xs text-cyan-500 uppercase tracking-wide">
                Select Diagnosis
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => submitDiagnosis("normal")}
                  data-testid="diagnosis-normal-btn"
                  disabled={isPaused || submitting || lastResult}
                  className="w-full cyber-button-success diagnosis-btn h-14 text-lg"
                >
                  <CheckCircle className="w-5 h-5 mr-3" />
                  NORMAL
                </Button>
                
                <Button 
                  onClick={() => submitDiagnosis("cancer")}
                  data-testid="diagnosis-cancer-btn"
                  disabled={isPaused || submitting || lastResult}
                  className="w-full cyber-button-danger diagnosis-btn h-14 text-lg"
                >
                  <XCircle className="w-5 h-5 mr-3" />
                  CANCER
                </Button>
                
                <Button 
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  data-testid="diagnosis-custom-toggle-btn"
                  disabled={isPaused || submitting || lastResult}
                  className="w-full cyber-button diagnosis-btn h-14"
                >
                  CUSTOM DIAGNOSIS
                </Button>

                {showCustomInput && (
                  <div className="space-y-3 p-4 bg-black/50 rounded border border-white/10 fade-in">
                    <p className="font-mono text-xs text-yellow-400">
                      * Typing time not counted
                    </p>
                    <Input 
                      value={customDiagnosis}
                      onChange={(e) => setCustomDiagnosis(e.target.value)}
                      placeholder="e.g., benign, cyst, polyp"
                      className="cyber-input"
                      data-testid="custom-diagnosis-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCustomSubmit();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleCustomSubmit}
                      data-testid="submit-custom-btn"
                      disabled={!customDiagnosis.trim()}
                      className="w-full cyber-button"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit Custom
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Session Stats */}
            <div className="pt-6 border-t border-white/10">
              <p className="font-mono text-xs text-cyan-500 uppercase tracking-wide mb-4">
                Session Stats
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 p-3 rounded">
                  <p className="font-mono text-2xl text-cyan-400">{currentIndex}</p>
                  <p className="text-xs text-slate-500">Reviewed</p>
                </div>
                <div className="bg-black/30 p-3 rounded">
                  <p className="font-mono text-2xl text-green-400">
                    {session?.correct_count || 0}
                  </p>
                  <p className="text-xs text-slate-500">Correct</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quit Confirmation Dialog */}
      <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <AlertDialogContent className="bg-cyber-gray border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-pink-400">
              Quit Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Your progress will be saved but the session will be marked as incomplete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cyber-button">
              Continue Session
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleQuit}
              data-testid="confirm-quit-btn"
              className="cyber-button-danger"
            >
              Quit Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
