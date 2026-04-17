import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { BookOpen, Mic, MicOff, Users, ArrowRight, Save, MessageSquare, Zap } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
// --- Constants ---
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// --- Shared UI Components (Shadcn mimics) ---
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-card text-card-foreground rounded-xl border border-border shadow-sm ${className}`}>{children}</div>
);
const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, type = "button" }: any) => {
  const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  const variants: any = {
    primary: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
    outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};
const Input = ({ value, onChange, placeholder, required = false, className = "" }: any) => (
  <input value={value} onChange={onChange} placeholder={placeholder} required={required} className={`flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`} />
);
const Label = ({ children }: any) => <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">{children}</label>;

// --- Home Component --- //
const Home = () => {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [joinSessionId, setJoinSessionId] = useState('');

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/sessions`, { teacherName, title: sessionTitle });
      navigate(`/teacher`, { state: { session: res.data } });
    } catch (err) { alert('Failed to create session'); }
  };
  const joinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinSessionId) navigate(`/student/${joinSessionId}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-24 p-6 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[100px] pointer-events-none" />

      <div className="text-center mb-12 z-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">Transform Live Teaching</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">Create interactive AI-powered sessions on the fly. Select a portal to begin.</p>
      </div>

      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 z-10">
        <Card className="p-8 student-card-hover border-t-4 border-t-primary">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6"><BookOpen size={24} /></div>
          <h2 className="text-2xl font-bold mb-2">Teacher Portal</h2>
          <p className="text-muted-foreground text-sm mb-6">Create a new live Spandan session</p>
          <form onSubmit={createSession} className="space-y-4">
            <div>
              <Label>Your Name</Label>
              <Input placeholder="e.g. Prof. Smith" value={teacherName} onChange={(e: any) => setTeacherName(e.target.value)} required />
            </div>
            <div>
              <Label>Session Topic</Label>
              <Input placeholder="e.g. Machine Learning Basics" value={sessionTitle} onChange={(e: any) => setSessionTitle(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full mt-2">Start Session <ArrowRight size={16} className="ml-2" /></Button>
          </form>
        </Card>

        <Card className="p-8 student-card-hover border-t-4 border-t-secondary">
          <div className="w-12 h-12 rounded-lg bg-secondary/30 flex items-center justify-center text-secondary-foreground mb-6"><Users size={24} /></div>
          <h2 className="text-2xl font-bold mb-2">Student Portal</h2>
          <p className="text-muted-foreground text-sm mb-6">Join an active Spandan session</p>
          <form onSubmit={joinSession} className="space-y-4 h-full flex flex-col">
            <div className="flex-1">
              <Label>Session ID</Label>
              <Input placeholder="Paste Session ID here" value={joinSessionId} onChange={(e: any) => setJoinSessionId(e.target.value)} required />
            </div>
            <Button type="submit" variant="secondary" className="w-full mt-auto">Join Session <ArrowRight size={16} className="ml-2" /></Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

// --- Teacher Dashboard --- //
const TeacherDashboard = ({ isCohost = false }: { isCohost?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(location.state?.session || null);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  
  const [isAutoGenerate, setIsAutoGenerate] = useState(false);
  const [manualQ, setManualQ] = useState('');
  const [manualOpts, setManualOpts] = useState(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState(0);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef(transcript);
  
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  useEffect(() => {
    if (isCohost && sessionId && !session) {
      axios.get(`${API_URL}/api/sessions/${sessionId}`)
        .then(res => setSession(res.data))
        .catch(() => navigate('/'));
    } else if (!session && !isCohost) {
      navigate('/');
    }
  }, [isCohost, sessionId, navigate, session]);

  useEffect(() => {
    if (!session) return;
    const s = io(API_URL);

    axios.get(`${API_URL}/api/questions/${session._id}`).then(res => setQuestions(res.data)).catch(console.error);
    axios.get(`${API_URL}/api/answers/${session._id}`).then(res => setAnswers(res.data)).catch(console.error);

    s.emit('join-session', session._id);
    s.on('new-questions', q => setQuestions(prev => {
      const ids = prev.map(x => x._id);
      return [...prev, ...q.filter((x: any) => !ids.includes(x._id))];
    }));
    s.on('new-answer', a => setAnswers(prev => {
      if (prev.find(x => x._id === a._id)) return prev;
      return [...prev, a];
    }));

    const sr = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (sr) {
      const recognition = new sr();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (e: any) => {
        let finalTrans = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) finalTrans += e.results[i][0].transcript;
        }
        if (finalTrans) setTranscript(p => p + ' ' + finalTrans);
      };
      
      recognition.onend = () => {
        // Only restart if we still want it to listen (rely on state updater pattern or ref if needed)
        // Here we can just dispatch an event or check a ref, but `isListening` in closure might be stale.
        // For simplicity, we restart if it stopped unexpectedly, but `stop()` explicitly pauses it.
      };
      recognitionRef.current = recognition;
    }
    return () => { recognitionRef.current?.stop(); s.disconnect(); };
  }, [session]);

  useEffect(() => {
    if (!isAutoGenerate || !session) return;
    const int = setInterval(async () => {
      const currentText = transcriptRef.current.trim();
      if (currentText.split(' ').length > 10) {
        try {
          await axios.post(`${API_URL}/api/generate-questions`, { sessionId: session._id, text: currentText });
          setTranscript('');
        } catch {}
      }
    }, 20000);
    return () => clearInterval(int);
  }, [isAutoGenerate, session]);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) { 
      recognitionRef.current.stop(); 
    } else { 
      try { recognitionRef.current.start(); } catch(e) {} 
    }
    setIsListening(!isListening);
  };

  const generateQs = async () => {
    if (!transcript.trim()) return;
    try {
      await axios.post(`${API_URL}/api/generate-questions`, { sessionId: session._id, text: transcript });
      setTranscript('');
    } catch { alert("AI failed"); }
  };

  const sendManualQ = async () => {
    if(!manualQ.trim() || manualOpts.some(o => !o.trim())) return alert("Fill all fields");
    const formattedOpts = [`A) ${manualOpts[0]}`, `B) ${manualOpts[1]}`, `C) ${manualOpts[2]}`, `D) ${manualOpts[3]}`];
    try {
      await axios.post(`${API_URL}/api/manual-question`, {
        sessionId: session._id,
        text: manualQ,
        options: formattedOpts,
        correctAnswer: formattedOpts[manualCorrect]     
      });
      setManualQ('');
      setManualOpts(['', '', '', '']);
    } catch { alert("Failed to send manual question"); }
  };

  if (!session) return null;

  // Calculate Leaderboard
  const scores: Record<string, number> = {};
  answers.forEach(a => {
    if (!scores[a.studentName]) scores[a.studentName] = 0;
    scores[a.studentName] += a.pointsEarned || 0;
  });
  const leaderboard = Object.entries(scores).map(([name, score]) => ({ name, score })).sort((a,b) => b.score - a.score).slice(0, 5);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Card className="p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/50 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session.title} {isCohost && <span className="text-sm bg-primary/20 text-primary px-2 py-1 rounded ml-2">Cohost Mode</span>}</h1>
          <div className="flex flex-col gap-3 mt-1">
            <p className="text-muted-foreground text-sm flex flex-wrap items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Session ID: <span className="font-mono bg-muted px-2 py-0.5 rounded">{session._id}</span>
              <span className="mx-2 hidden md:inline">|</span>
              Cohost Link: <span className="font-mono bg-muted/50 px-2 py-0.5 rounded cursor-copy hover:bg-muted" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/cohost/${session._id}`); alert('Link copied!');}}>Copy</span>
            </p>
            <div className="bg-white p-2 rounded-lg self-start border flex gap-4 items-center shadow-sm">
              <QRCodeCanvas value={`${window.location.origin}/student/${session._id}`} size={70} />
              <div className="text-sm font-medium text-muted-foreground max-w-[150px]">Students can scan to join instantly without typing the ID!</div>
            </div>
          </div>
        </div>
        {!isCohost && (
          <Button onClick={toggleListen} variant={isListening ? 'destructive' : 'primary'} className="w-full md:w-auto">
            {isListening ? <MicOff size={16} className="mr-2" /> : <Mic size={16} className="mr-2" />}
            {isListening ? 'Stop Mic' : 'Start Mic'}
          </Button>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="flex flex-col overflow-hidden h-[600px] bg-card/50">
          <div className="p-4 border-b flex justify-between items-center bg-muted/20">
            <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-primary" /> Live Transcript</h2>
            <Button onClick={generateQs} variant="secondary" className="h-8 shadow-sm">
              <Zap size={14} className="mr-1.5 text-primary" /> Generate Qs
            </Button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 text-muted-foreground leading-relaxed text-sm font-medium flex flex-col relative">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Start recording with the mic, or simply type your lecture topic here. The AI will generate questions based on this text..."
              className="w-full h-full bg-transparent border-none resize-none focus:outline-none text-foreground placeholder-muted-foreground/60 p-2"
            />
          </div>
          
          <div className="p-4 border-t bg-muted/20 flex gap-4 flex-col xl:flex-row shadow-inner">
             <div className="flex-[1] bg-card p-4 rounded-xl shadow-sm border">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-sm text-foreground flex items-center gap-2"><Zap size={14} className="text-amber-500" /> Auto-Generator</h3>
                 <Button onClick={() => setIsAutoGenerate(!isAutoGenerate)} variant={isAutoGenerate ? 'primary' : 'outline'} className={isAutoGenerate ? "bg-amber-500 hover:bg-amber-600 animate-pulse text-xs h-8 px-2" : "text-xs h-8 px-2"}>
                   {isAutoGenerate ? 'Auto: ON (20s)' : 'Auto: OFF'}
                 </Button>
               </div>
               <p className="text-xs text-muted-foreground">When ON, AI reads the active transcript every 20 seconds and automatically generates a question.</p>
             </div>
             
             <div className="flex-[2] bg-card p-4 rounded-xl shadow-sm border flex flex-col gap-3">
               <h3 className="font-bold text-sm text-foreground flex items-center gap-2"><MessageSquare size={14} className="text-primary"/> Host Override: Manual Question</h3>
               <Input value={manualQ} onChange={(e: any) => setManualQ(e.target.value)} placeholder="Type custom question..." className="text-xs h-8 bg-primary/5 border-primary/20" />
               <div className="grid grid-cols-2 gap-2">
                 {manualOpts.map((opt, i) => (
                   <div key={i} className="flex items-center gap-2">
                     <div onClick={() => setManualCorrect(i)} className={`w-4 h-4 rounded-full border flex-shrink-0 cursor-pointer flex items-center justify-center ${manualCorrect === i ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground'}`}>
                        {manualCorrect === i && <span className="w-1.5 h-1.5 rounded-full bg-white block"></span>}
                     </div>
                     <Input value={opt} onChange={(e: any) => {
                        const newO = [...manualOpts];
                        newO[i] = e.target.value;
                        setManualOpts(newO);
                     }} placeholder={`Option ${['A','B','C','D'][i]}`} className="text-xs h-7" />
                   </div>
                 ))}
               </div>
               <Button onClick={sendManualQ} className="w-full mt-1 bg-primary text-xs h-8">Push to Class</Button>
             </div>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden h-[600px] bg-card/50">
          <div className="p-4 border-b bg-muted/20">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Users size={18} className="text-secondary-foreground" /> Students Activity Overview</h2>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-8">
            {questions.length === 0 && <p className="text-center text-muted-foreground py-10">No questions generated yet. Type a topic and click "Generate Qs"!</p>}
            
            {questions.length > 0 && (
               <>
                  <div>
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">Top 5 Leaderboard <span className="text-lg">🔥</span></h3>
                      <Card className="p-0 overflow-hidden shadow-sm">
                        {leaderboard.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No scores yet.</p> : leaderboard.map((student, idx) => (
                          <div key={student.name} className={`flex justify-between items-center p-3 border-b last:border-0 ${idx === 0 ? 'bg-amber-500/10' : idx === 1 ? 'bg-zinc-300/20' : idx === 2 ? 'bg-orange-500/10' : 'bg-card'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`font-black text-lg w-5 text-center ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-500' : idx === 2 ? 'text-orange-500' : 'text-muted-foreground'}`}>{idx + 1}</span>
                              <span className="font-semibold text-foreground">{student.name}</span>
                            </div>
                            <span className="font-bold text-primary">{student.score} pts</span>
                          </div>
                        ))}
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xl font-bold mb-4">Class Performance 📊</h3>
                      {questions.map((q, idx) => {
                        const answersForQ = answers.filter(a => a.questionId === q._id);
                        const total = answersForQ.length;
                        const correctCount = answersForQ.filter(a => a.text === q.correctAnswer).length;
                        const wrongCount = total - correctCount;
                        const percent = total > 0 ? Math.round((correctCount/total)*100) : 0;
                        return (
                          <Card key={q._id || idx} className="p-4 shadow-sm flex flex-col">
                            <p className="font-semibold text-sm mb-3">Q: {q.text}</p>
                            <div className="mb-3 text-xs bg-primary/5 p-2 rounded border border-primary/10">
                               <span className="font-semibold text-muted-foreground">Correct Answer: </span>
                               <span className="text-emerald-700 font-bold">{q.correctAnswer || "None"}</span>
                            </div>
                            <div className="w-full bg-red-100 rounded-full h-2 mb-2 flex overflow-hidden">
                               <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-1">
                               <span className="text-emerald-700 font-bold">{correctCount} Correct ({percent}%)</span>
                               <span className="text-red-500 font-bold">{wrongCount} Wrong</span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
               </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Student Portal --- //
const StudentPortal = () => {
  const { sessionId } = useParams();
  const [questions, setQuestions] = useState<any[]>([]);
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [studentName, setStudentName] = useState('');
  const [joined, setJoined] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{qId: string, isCorrect: boolean, selectedOpt: string, pointsEarned?: number} | null>(null);

  const [timeLeft, setTimeLeft] = useState(30);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const unanswered = questions.filter(q => !submittedIds.includes(q._id));
  const currentQId = unanswered[0]?._id || null;

  useEffect(() => {
    if (currentQId !== activeQuestionId) {
      setActiveQuestionId(currentQId);
      setTimeLeft(30);
    }
  }, [currentQId, activeQuestionId]);

  useEffect(() => {
    if (!currentQId) return;
    if (timeLeft <= 0) {
      submitA(currentQId, "Time's up!");
      return;
    }
    const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, currentQId]);

  useEffect(() => {
    if (!sessionId) return;
    const s = io(API_URL);

    axios.get(`${API_URL}/api/questions/${sessionId}`).then(res => setQuestions(res.data)).catch(console.error);
    axios.get(`${API_URL}/api/answers/${sessionId}`).then(res => setAllAnswers(res.data)).catch(console.error);

    s.emit('join-session', sessionId);
    s.on('new-questions', q => setQuestions(p => {
      const ids = p.map(x => x._id);
      return [...p, ...q.filter((x: any) => !ids.includes(x._id))];
    }));
    s.on('new-answer', a => setAllAnswers(prev => {
      if (prev.find(x => x._id === a._id)) return prev;
      return [...prev, a];
    }));
    return () => { s.disconnect(); };
  }, [sessionId]);

  const submitA = async (qId: string, answerText: string) => {
    if (!answerText || !answerText.trim()) return;
    setAnswers(p => ({ ...p, [qId]: answerText }));
    try {
      const res = await axios.post(`${API_URL}/api/answers`, { sessionId, questionId: qId, studentName, text: answerText });
      const savedAnswer = res.data;
      
      const questionData = questions.find(q => q._id === qId);
      if (questionData && questionData.correctAnswer) {
        setFeedback({ qId, isCorrect: savedAnswer.isCorrect, selectedOpt: answerText, pointsEarned: savedAnswer.pointsEarned });
        setTimeout(() => {
           setSubmittedIds(p => [...p, qId]);
           setFeedback(null);
        }, 3000);
      } else {
        setSubmittedIds(p => [...p, qId]);
      }
    } catch { alert('Failed'); }
  };

  if (!joined) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-8 max-w-sm w-full border-t-4 border-t-secondary student-card-hover">
        <h2 className="text-2xl font-bold mb-2 text-center">Join Session</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">Enter your name to start answering questions.</p>
        <Input placeholder="Your Name" value={studentName} onChange={(e: any) => setStudentName(e.target.value)} className="mb-4 text-center" />
        <Button onClick={() => setJoined(true)} variant="secondary" className="w-full">Enter Classroom</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6 lg:mt-10">
        <Card className="p-6 flex justify-between items-center bg-card/60 backdrop-blur">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Questions</h1>
            <p className="text-muted-foreground text-sm font-mono mt-1">ID: {sessionId}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary-foreground font-bold border border-secondary/30">
            {studentName.charAt(0).toUpperCase()}
          </div>
        </Card>

        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <span className="w-3 h-3 bg-primary rounded-full animate-pulse mb-4"></span>
              <p>Waiting for the teacher to post questions...</p>
            </div>
          ) : (() => {
            if (unanswered.length === 0) {
              const answeredQs = questions.filter(q => submittedIds.includes(q._id));
              const scorableQs = answeredQs.filter(q => q.correctAnswer);
              const totalScorable = scorableQs.length;
              const correct = scorableQs.filter(q => answers[q._id] === q.correctAnswer).length;
              const percentage = totalScorable > 0 ? Math.round((correct / totalScorable) * 100) : 0;
              
              // Calculate Leaderboard
              const scores: Record<string, number> = {};
              allAnswers.forEach(a => {
                if (!scores[a.studentName]) scores[a.studentName] = 0;
                scores[a.studentName] += a.pointsEarned || 0;
              });
              const leaderboard = Object.entries(scores).map(([name, score]) => ({ name, score })).sort((a,b) => b.score - a.score).slice(0, 5);
              
              const finalSessionPoints = allAnswers.filter(a => a.studentName === studentName).reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
              
              return (
                <div className="flex flex-col items-center justify-center py-12 animate-zoom-in w-full text-center">
                  <div className="w-20 h-20 bg-emerald-100/50 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-500/20">
                    <span className="text-4xl">🏆</span>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">Quiz Complete!</h2>
                  <p className="text-muted-foreground mb-8 text-sm">Waiting for the teacher to post more questions...</p>
                  
                  {totalScorable > 0 && (
                    <Card className="p-6 bg-card w-full max-w-sm border-t-4 border-t-emerald-500 shadow-lg relative overflow-hidden flex flex-col items-center mb-6 mx-auto">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 font-mono">Your Final Score</h3>
                      <div className="flex flex-col items-center justify-center mb-4">
                        <span className="text-6xl font-black text-emerald-600 tracking-tighter">{finalSessionPoints} pts</span>
                        <span className="text-md font-semibold text-muted-foreground mt-2">{correct} / {totalScorable} Correct</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden shadow-inner">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-4 font-medium">
                        {percentage === 100 ? "Perfect Score! Amazing job 🌟" : percentage >= 70 ? "Great effort! 👏" : "Keep practicing! 💪"}
                      </p>
                    </Card>
                  )}

                  <Link to={`/dashboard/${studentName}`} className="mb-10 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80">
                    View Global Dashboard <ArrowRight size={16} className="ml-2" />
                  </Link>

                  <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 text-left mx-auto">
                    {/* Leaderboard */}
                    <div>
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">Top 5 Leaderboard <span className="text-lg">🔥</span></h3>
                      <Card className="p-0 overflow-hidden shadow-sm">
                        {leaderboard.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No scores yet.</p> : leaderboard.map((student, idx) => (
                          <div key={student.name} className={`flex justify-between items-center p-3 border-b last:border-0 ${idx === 0 ? 'bg-amber-500/10' : idx === 1 ? 'bg-zinc-300/20' : idx === 2 ? 'bg-orange-500/10' : 'bg-transparent'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`font-black text-lg w-5 text-center ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-500' : idx === 2 ? 'text-orange-500' : 'text-muted-foreground'}`}>{idx + 1}</span>
                              <span className="font-semibold text-foreground">{student.name} {student.name === studentName ? <span className="text-xs font-normal text-muted-foreground ml-1">(You)</span> : ""}</span>
                            </div>
                            <span className="font-bold text-primary">{student.score} pts</span>
                          </div>
                        ))}
                      </Card>
                    </div>

                    {/* Class Stats */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold mb-4">Class Performance 📊</h3>
                      {answeredQs.map(q => {
                        const answersForQ = allAnswers.filter(a => a.questionId === q._id);
                        const total = answersForQ.length;
                        const correctCount = answersForQ.filter(a => a.text === q.correctAnswer).length;
                        const wrongCount = total - correctCount;
                        const percent = total > 0 ? Math.round((correctCount/total)*100) : 0;
                        const studentAns = answers[q._id];
                        const isStudentCorrect = studentAns === q.correctAnswer;
                        return (
                          <Card key={q._id} className="p-4 shadow-sm flex flex-col">
                            <p className="font-semibold text-sm mb-3">Q: {q.text}</p>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                               <div className="bg-primary/5 p-2 rounded border border-primary/10">
                                  <div className="text-muted-foreground font-semibold mb-1">Correct Answer:</div>
                                  <div className="font-bold text-emerald-600">{q.correctAnswer || "None"}</div>
                               </div>
                               <div className={`p-2 rounded border ${isStudentCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                  <div className="text-muted-foreground font-semibold mb-1">Your Answer:</div>
                                  <div className={`font-bold ${isStudentCorrect ? 'text-emerald-700' : 'text-red-600'}`}>{studentAns || "None"}</div>
                               </div>
                            </div>

                            <div className="w-full bg-red-100 rounded-full h-2 mb-2 flex overflow-hidden">
                               <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-1">
                               <span className="text-emerald-700 font-bold">{correctCount} Correct ({percent}%)</span>
                               <span className="text-red-500 font-bold">{wrongCount} Wrong</span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }
            const q = unanswered[0];
            
            // Extract options intelligently
            let questionText = q.text;
            let options: string[] = q.options || [];
            
            // Fallback for older sessions without an options array
            if (!q.options || q.options.length === 0) {
               const parts = q.text.split('\n');
               questionText = parts[0];
               options = parts.filter((p: string) => p.match(/^[A-D]\)/));
            }

            return (
              <Card className="p-6 quiz-option-hover animate-zoom-in border-l-4 border-l-primary shadow-sm bg-card/80">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <Zap size={14} className="text-primary" /> Active Question
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse shadow-sm' : 'bg-primary/10 text-primary'}`}>
                    ⏱ {timeLeft}s remaining
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-6 overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${(timeLeft / 30) * 100}%` }}></div>
                </div>
                <p className="font-semibold mb-6 text-card-foreground flex gap-3 whitespace-pre-wrap leading-relaxed">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs flex-shrink-0 mt-0.5">Q</span>
                  {questionText}
                </p>
                {options.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {options.map((opt: string, idx: number) => {
                      const isSelected = feedback?.qId === q._id && feedback?.selectedOpt === opt;
                      const isCorrectAnswer = feedback?.qId === q._id && q.correctAnswer === opt;
                      let btnClass = "justify-start h-auto py-3 px-4 text-left whitespace-normal transition-all duration-200";
                      
                      if (feedback?.qId === q._id) {
                         if (isCorrectAnswer) btnClass += " bg-emerald-100 border-emerald-500 text-emerald-800 pointer-events-none";
                         else if (isSelected) btnClass += " bg-red-100 border-red-500 text-red-800 pointer-events-none";
                         else btnClass += " opacity-50 pointer-events-none";
                      } else {
                         btnClass += " hover:bg-primary/5 hover:border-primary bg-background";
                      }

                      return (
                        <div key={idx} className="relative w-full">
                          <Button 
                            variant="outline" 
                            className={`w-full ${btnClass}`}
                            onClick={() => submitA(q._id, opt)}
                          >
                            {opt}
                          </Button>
                          {isSelected && isCorrectAnswer && feedback?.pointsEarned !== undefined && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-bounce z-10 font-black text-2xl text-emerald-600 drop-shadow-md whitespace-nowrap bg-white/80 px-3 py-1 rounded-full border border-emerald-200">
                              +{feedback.pointsEarned} Points!
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex gap-2 mt-4">
                    <Input value={answers[q._id] || ''} onChange={(e: any) => setAnswers(p => ({ ...p, [q._id]: e.target.value }))} placeholder="Your answer (e.g. A, B, C, D)..." className="flex-1 bg-background" />
                    <Button onClick={() => submitA(q._id, answers[q._id])}><Save size={16} className="mr-2" /> Submit</Button>
                  </div>
                )}
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// --- Student Global Dashboard --- //
const StudentDashboard = () => {
  const { studentName } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!studentName) return;
    axios.get(`http://localhost:5000/api/students/${studentName}/dashboard`)
      .then(res => setData(res.data))
      .catch(console.error);
  }, [studentName]);

  if (!data) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
       <span className="w-8 h-8 rounded-full bg-primary animate-ping mb-4"></span>
       <p className="text-muted-foreground font-medium">Loading Dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
      
      <div className="max-w-3xl mx-auto mt-4 md:mt-10 relative z-10">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8">
          ← Back to Home
        </Link>
        <div className="text-center mb-10 text-foreground">
           <div className="w-24 h-24 mx-auto bg-primary text-primary-foreground font-bold text-4xl rounded-full flex items-center justify-center mb-4 shadow-lg border-4 border-background">
              {studentName?.charAt(0).toUpperCase()}
           </div>
           <h1 className="text-4xl font-extrabold tracking-tight">{studentName}'s Dashboard</h1>
           <p className="text-muted-foreground mt-2 text-lg">Your global performance across all Spandan sessions</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
           <Card className="p-8 border-t-4 border-t-emerald-500 bg-card text-center relative overflow-hidden shadow-md">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <h3 className="text-muted-foreground uppercase tracking-widest text-sm font-bold font-mono">Total XP Score</h3>
              <p className="text-7xl font-black text-emerald-600 mt-4 tracking-tighter">{data.student.totalScore}</p>
              <p className="text-sm font-medium text-emerald-700/80 mt-2">Global Leaderboard Points</p>
           </Card>

           <Card className="p-8 border-t-4 border-t-amber-500 bg-card text-center relative overflow-hidden shadow-md">
              <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -ml-10 -mt-10"></div>
              <h3 className="text-muted-foreground uppercase tracking-widest text-sm font-bold font-mono">Accuracy Rate</h3>
              <div className="flex items-center justify-center gap-1 mt-4">
                 <p className="text-7xl font-black text-amber-500 tracking-tighter">{data.accuracy}</p>
                 <span className="text-4xl font-bold text-amber-500/50">%</span>
              </div>
              <p className="text-sm font-medium text-amber-700/80 mt-2">{data.correctCount} correct out of {data.answersCount} attempts</p>
           </Card>
        </div>

        <Card className="p-6 shadow-sm">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
             <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-600"><Zap size={20}/></div> 
             Your Badges & Achievements
           </h2>
           {data.student.badges.length === 0 ? (
             <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-muted">
                <p className="text-muted-foreground font-medium">Keep playing to earn badges!</p>
             </div>
           ) : (
             <div className="flex gap-4 flex-wrap">
               {data.student.badges.map((b: string, i: number) => (
                 <div key={i} className="px-5 py-2.5 rounded-full bg-secondary/80 text-secondary-foreground font-bold border border-secondary shadow-sm flex items-center gap-2 hover:scale-105 transition-transform cursor-default">
                   {b}
                 </div>
               ))}
             </div>
           )}
        </Card>
      </div>
    </div>
  );
};

// --- App Root --- //
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/cohost/:sessionId" element={<TeacherDashboard isCohost={true} />} />
      <Route path="/student/:sessionId" element={<StudentPortal />} />
      <Route path="/dashboard/:studentName" element={<StudentDashboard />} />
    </Routes>
  );
}

export default App;