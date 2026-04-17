require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const nlp = require("compromise");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Connect Database
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/spandan")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// --- Schemas & Models ---
const Session = mongoose.model('Session', new mongoose.Schema({
  teacherName: String,
  title: String,
  isActive: { type: Boolean, default: true },
}));

const Transcript = mongoose.model('Transcript', new mongoose.Schema({
  sessionId: String,
  text: String,
}));

const Question = mongoose.model('Question', new mongoose.Schema({
  sessionId: String,
  text: String,
  options: [String],
  correctAnswer: String,
  createdAt: { type: Date, default: Date.now },
}));

const Answer = mongoose.model('Answer', new mongoose.Schema({
  sessionId: String,
  questionId: String,
  studentName: String,
  text: String,
  isCorrect: Boolean,
  timeTakenMs: Number,
  pointsEarned: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}));

const Student = mongoose.model('Student', new mongoose.Schema({
  name: { type: String, unique: true },
  totalScore: { type: Number, default: 0 },
  badges: [String],
  sessionsAttended: [{ type: String }],
}));

// --- Routes ---
app.get("/", (req, res) => res.send("Backend is working 🚀"));

app.post("/api/sessions", async (req, res) => {
  const session = await Session.create(req.body);
  res.json(session);
});

app.get("/api/sessions/:id", async (req, res) => {
  const session = await Session.findById(req.params.id);
  res.json(session);
});

app.get("/api/questions/:sessionId", async (req, res) => {
  const questions = await Question.find({ sessionId: req.params.sessionId });
  res.json(questions);
});

app.get("/api/answers/:sessionId", async (req, res) => {
  const answers = await Answer.find({ sessionId: req.params.sessionId });
  res.json(answers);
});

const mockTriviaDB = {
  "c++": [
    { q: "Which programming language is known for its use in competitive programming and system-level applications?", options: ["A) HTML", "B) C++", "C) CSS", "D) JavaScript"], answer: "B) C++" },
    { q: "Which feature of C++ allows it to execute object-oriented programming?", options: ["A) Global variables", "B) Classes and Objects", "C) DOM Manipulation", "D) Package Manager"], answer: "B) Classes and Objects" },
    { q: "What is the correct syntax to output 'Hello World' in C++?", options: ["A) print('Hello World')", "B) System.out.println('Hello World')", "C) console.log('Hello World')", "D) cout << 'Hello World'"], answer: "D) cout << 'Hello World'" }
  ],
  "react": [
    { q: "What runs on the concept of a Virtual DOM to optimize UI rendering?", options: ["A) Angular", "B) Vue", "C) React", "D) Svelte"], answer: "C) React" },
    { q: "Which of the following is used to manage state in a React functional component?", options: ["A) useEffect", "B) useState", "C) Redux", "D) Context"], answer: "B) useState" },
    { q: "What is JSX in React?", options: ["A) A syntax extension for JavaScript", "B) A new programming language", "C) A CSS framework", "D) A database query language"], answer: "A) A syntax extension for JavaScript" }
  ],
  "python": [
    { q: "Which programming language is renowned for data science, AI, and simple readability?", options: ["A) Java", "B) Python", "C) C#", "D) C++"], answer: "B) Python" },
    { q: "How do you define a function in Python?", options: ["A) function myFunc()", "B) def myFunc():", "C) create myFunc()", "D) func myFunc()"], answer: "B) def myFunc():" },
    { q: "Which of the following data types is NOT native to Python?", options: ["A) List", "B) Dictionary", "C) Tuple", "D) Array"], answer: "D) Array" }
  ],
  "javascript": [
    { q: "Which language is primarily used for adding interactivity to web pages?", options: ["A) HTML", "B) CSS", "C) Python", "D) JavaScript"], answer: "D) JavaScript" },
    { q: "Which symbol is used for strict equality comparison in JavaScript?", options: ["A) =", "B) ==", "C) ===", "D) =>"], answer: "C) ===" },
    { q: "What does DOM stand for?", options: ["A) Document Object Model", "B) Data Object Method", "C) Digital Oriented Machine", "D) Display Output Management"], answer: "A) Document Object Model" }
  ],
  "java": [
    { q: "Which programming language was created with the philosophy 'Write once, run anywhere'?", options: ["A) C++", "B) Python", "C) Java", "D) Ruby"], answer: "C) Java" },
    { q: "What is the entry point method for an application running in standard Java?", options: ["A) start()", "B) init()", "C) main()", "D) run()"], answer: "C) main()" },
    { q: "Which keyword is used to create a new object in Java?", options: ["A) create", "B) new", "C) object", "D) instance"], answer: "B) new" }
  ],
  "html": [
    { q: "What does HTML stand for?", options: ["A) Hyper Text Markup Language", "B) High Tech Modern Language", "C) Hyper Transfer Module Link", "D) Home Tool Markup Language"], answer: "A) Hyper Text Markup Language" },
    { q: "Which tag is used to create a hyperlink?", options: ["A) <link>", "B) <a>", "C) <href>", "D) <hyper>"], answer: "B) <a>" },
    { q: "Which tag is used for the largest heading in HTML?", options: ["A) <h6>", "B) <heading>", "C) <h1>", "D) <head>"], answer: "C) <h1>" }
  ],
  "quantum": [
    { q: "What is the fundamental unit of light and electromagnetic interaction in quantum physics?", options: ["A) Electron", "B) Proton", "C) Photon", "D) Neutron"], answer: "C) Photon" },
    { q: "Which principle states that you cannot simultaneously know both the exact position and momentum of a particle?", options: ["A) Pauli Exclusion Principle", "B) Heisenberg Uncertainty Principle", "C) Schrödinger's Equation", "D) Bohr Model"], answer: "B) Heisenberg Uncertainty Principle" },
    { q: "What is quantum entanglement?", options: ["A) Particles moving in opposite directions", "B) Particles linking state regardless of distance", "C) Particles changing mass over time", "D) Particles losing their charge"], answer: "B) Particles linking state regardless of distance" }
  ],
  "physics": [
    { q: "What is the SI unit of force?", options: ["A) Joule", "B) Watt", "C) Newton", "D) Pascal"], answer: "C) Newton" },
    { q: "Which law states that for every action, there is an equal and opposite reaction?", options: ["A) Newton's First Law", "B) Newton's Second Law", "C) Newton's Third Law", "D) Law of Conservation of Energy"], answer: "C) Newton's Third Law" },
    { q: "What is the rate of change of velocity called?", options: ["A) Speed", "B) Momentum", "C) Acceleration", "D) Inertia"], answer: "C) Acceleration" }
  ],
  "frontend": [
    { q: "What is the primary role of a frontend developer?", options: ["A) Managing databases", "B) Designing server architecture", "C) Building the user interface and experience", "D) Configuring DNS settings"], answer: "C) Building the user interface and experience" },
    { q: "Which of these is a popular frontend framework/library?", options: ["A) Django", "B) Spring Boot", "C) React", "D) Laravel"], answer: "C) React" },
    { q: "How does the frontend communicate with the backend?", options: ["A) Through HTTP/API requests", "B) By reading the hard drive directly", "C) Through CSS styling", "D) By modifying the server registry"], answer: "A) Through HTTP/API requests" }
  ],
  "backend": [
    { q: "What is the main responsibility of backend development?", options: ["A) Styling buttons", "B) Managing server logic, databases, and APIs", "C) Designing logos", "D) Animating web pages"], answer: "B) Managing server logic, databases, and APIs" },
    { q: "Which language is commonly used for backend development?", options: ["A) HTML", "B) CSS", "C) Node.js", "D) XML"], answer: "C) Node.js" },
    { q: "What does an API do in backend development?", options: ["A) Renders HTML", "B) Bridges communication between the client and server", "C) Styles the DOM", "D) Compresses images"], answer: "B) Bridges communication between the client and server" }
  ],
  "docker": [
    { q: "What is the primary purpose of Docker?", options: ["A) To edit text files", "B) To containerize applications for consistent environments", "C) To host domain names", "D) To write styling rules"], answer: "B) To containerize applications for consistent environments" },
    { q: "What is a Docker image?", options: ["A) A lightweight, standalone, executable package of software", "B) A JPEG picture", "C) A virtual machine OS", "D) A backup file"], answer: "A) A lightweight, standalone, executable package of software" },
    { q: "Which command runs a Docker container?", options: ["A) docker start", "B) docker push", "C) docker run", "D) docker build"], answer: "C) docker run" }
  ],
  "css": [
    { q: "What does CSS stand for?", options: ["A) Creative Style Sheets", "B) Cascading Style Sheets", "C) Computer Style Sheets", "D) Colorful Style Sheets"], answer: "B) Cascading Style Sheets" },
    { q: "Which CSS property controls the text size?", options: ["A) font-style", "B) text-size", "C) font-size", "D) text-style"], answer: "C) font-size" },
    { q: "How do you select an element with id 'demo'?", options: ["A) .demo", "B) #demo", "C) demo", "D) *demo"], answer: "B) #demo" }
  ],
  "sql": [
    { q: "What does SQL stand for?", options: ["A) Structured Query Language", "B) Strong Question Language", "C) Structured Question Language", "D) Simple Query Language"], answer: "A) Structured Query Language" },
    { q: "Which statement is used to extract data from a database?", options: ["A) GET", "B) OPEN", "C) SELECT", "D) EXTRACT"], answer: "C) SELECT" },
    { q: "Which clause is used to filter records?", options: ["A) FILTER", "B) WHERE", "C) ORDER BY", "D) SORT"], answer: "B) WHERE" }
  ],
  "node": [
    { q: "Which engine is Node.js built on?", options: ["A) SpiderMonkey", "B) V8 JavaScript Engine", "C) Chakra", "D) JavaScriptCore"], answer: "B) V8 JavaScript Engine" },
    { q: "Which built-in module is used directly to create an HTTP server in Node.js?", options: ["A) http", "B) url", "C) path", "D) fs"], answer: "A) http" },
    { q: "What does npm stand for?", options: ["A) Node Program Manager", "B) Node Package Manager", "C) Node Project Module", "D) New Package Manager"], answer: "B) Node Package Manager" }
  ]
};

app.post("/api/generate-questions", async (req, res) => {
  const { sessionId, text } = req.body;
  
  if (!text || text.trim().length < 2) {
     return res.status(400).json({ error: "Transcript is too short." });
  }

  try {
    const words = text.split(/[\s,.]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 2);
    
    let generatedQuestions = [];

    // 1. Check Mock Trivia Database first
    for (const w of words) {
       if (mockTriviaDB[w] && generatedQuestions.length < 5) {
          // Push items without overwriting to allow combining
          for (let q of mockTriviaDB[w]) {
             if (generatedQuestions.length < 5) {
                 // Check to avoid exact duplicates
                 if (!generatedQuestions.some(existing => existing.q === q.q)) {
                    generatedQuestions.push(q);
                 }
             }
          }
       }
    }

    // 2. Transcript-based Direct Definition Extraction (Prioritize extracting definitions explicitly mentioned by the instructor)
    if (generatedQuestions.length < 5) {
      const sentencesRaw = text.match(/[^.!?]+[.!?]+/g) || [text];
      for (const sent of sentencesRaw) {
         if (generatedQuestions.length >= 5) break;
         const s = sent.trim();
         // Match explicit "X is a Y" definitions natively
         const match = s.match(/^(.*?)\b(is a|is an|is the|are a|are an|are the|refers to|is defined as)\b(.*)/i);
         if (match) {
             const concept = match[1].trim();
             const def = match[3].trim();
             
             // Concept must be concise (1-5 words), not a pronoun
             if (concept.split(' ').length <= 5 && concept.length > 2 && !/^(it|this|that|he|she|they|we|you|i)\s*$/i.test(concept)) {
                let shortDef = def;

                // Aggressively chop definitions to keep MCQs straight and punchy
                const truncateMatch = shortDef.match(/^(.*?)(?:,|\bthat\b|\bwhich\b|\bwho\b|\bwhere\b|\benabling\b|\ballowing\b|\btypically\b|\bfor example\b)/i);
                if (truncateMatch && truncateMatch[1].trim().length > 5) shortDef = truncateMatch[1].trim();

                const words = shortDef.split(' ');
                if (words.length > 10) shortDef = words.slice(0, 10).join(' ') + "...";
                
                const betterDistractors = ["Data synthesis", "Algorithm optimization", "Cloud computing", "Microservices", "Design thinking", "Neural networks", "System architecture", "Database indexing"];
                let optionsSet = new Set([concept]);
                while(optionsSet.size < 4) {
                  optionsSet.add(betterDistractors[Math.floor(Math.random() * betterDistractors.length)]);
                }
                const optionsArr = Array.from(optionsSet).sort(() => Math.random() - 0.5);
                const formattedOptions = [`A) ${optionsArr[0]}`, `B) ${optionsArr[1]}`, `C) ${optionsArr[2]}`, `D) ${optionsArr[3]}`];
                const correctAnswer = formattedOptions.find((o) => o.includes(concept));
                
                const newQ = {
                   q: `Based on the lecture, which concept ${match[2]} ${shortDef}?`,
                   options: formattedOptions,
                   answer: correctAnswer
                };
                
                if (!generatedQuestions.some(existing => existing.q === newQ.q)) {
                   generatedQuestions.push(newQ);
                }
             }
         }
      }
    }

    // 3. Fallback: Conceptual Definition Questions using NLP + Wikipedia
    if (generatedQuestions.length < 5) {
      const distractors = ["concept", "process", "system", "theory", "method", "data", "analysis", "function", "variable", "component", "infrastructure", "framework"];
      
      const doc = nlp(text);
      // Clean and filter nouns carefully: drop determiners, remove long descriptive phrases, and trailing punctuation
      const nouns = Array.from(new Set(doc.nouns().out('array')
         .map(n => n.replace(/^[Tt]heir |^[Oo]ur |^[Tt]hese |^[Tt]hose |^[Tt]he |^[Aa] |^[Aa]n /g, '').replace(/[,.!?]+$/, '').trim())
         .filter(n => n.length > 4 && n.split(' ').length <= 4 && !['this','that','they','them','these','those','what','which','there','topic','lecture','something','anything', 'problem', 'statement', 'performance'].includes(n.toLowerCase()))
      ));
      
      let fillCount = 5 - generatedQuestions.length;
      // Get plenty of fallback nouns to fill the rest gap!
      const topNouns = nouns.sort((a, b) => b.length - a.length).slice(0, fillCount + 2);
      
      for (const topic of topNouns) {
        if (generatedQuestions.length >= 5) break;
        
        try {
          const headers = { 'User-Agent': 'SpandanApp/1.0 (contact@example.com)' };
          const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&utf8=&format=json`, { timeout: 3000, headers });
          
          if (searchRes.data && searchRes.data.query && searchRes.data.query.search.length > 0) {
             const bestTitle = searchRes.data.query.search[0].title;
             const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`, { timeout: 3000, headers });
             
             const extract = wikiRes.data.extract || "";
             const sentences = extract.match(/[^.!?]+[.!?]+/g) || [extract];
             
             if (sentences.length > 0 && sentences[0].length > 30) {
                const s = sentences[0].trim();
                
                let cleanTitle = bestTitle.replace(/\s*\(.*?\)\s*/g, '').trim();
                let shortDef = s;
                let targetWord = cleanTitle; 
                
                // Match patterns focusing on definition extraction
                const match = s.match(/\b(is a|is an|is the|refers to|is defined as|are a|are an|are the|is|are)\b(.*)/i);
                
                const betterDistractors = ["Data mining", "System architecture", "Algorithm optimization", "Cloud computing", "Data modeling", "Quantum structures", "Database indexing", "Parallel processing", "Microservices", "Design thinking", "Neural networks"];
                
                if (match) {
                    let definition = match[2];
                    // Truncate at the first comma or explicit example clauses to keep the MCQ straight and simple
                    const truncateMatch = definition.match(/^(.*?)(?:,|\bthat\b|\bwhich\b|\bwho\b|\bwhere\b|\bsuch as\b|\bin which\b|\btypically\b|\bfor example\b)/i);
                    
                    if (truncateMatch && truncateMatch[1].trim().length > 5) {
                        shortDef = truncateMatch[1].trim();
                    } else {
                        shortDef = definition.trim();
                    }
                    
                    // Cap to Max 10 words for punchy, straightforward MCQs (not essays)
                    const words = shortDef.split(' ');
                    if (words.length > 10) {
                        shortDef = words.slice(0, 10).join(' ') + "...";
                    }
                    
                    let optionsSet = new Set([targetWord]);
                    while(optionsSet.size < 4) {
                      optionsSet.add(betterDistractors[Math.floor(Math.random() * betterDistractors.length)]);
                    }
                    const optionsArr = Array.from(optionsSet).sort(() => Math.random() - 0.5);
                    const formattedOptions = [`A) ${optionsArr[0]}`, `B) ${optionsArr[1]}`, `C) ${optionsArr[2]}`, `D) ${optionsArr[3]}`];
                    const correctAnswer = formattedOptions.find((o) => o.includes(targetWord));
                    
                    generatedQuestions.push({ 
                      q: `Which concept is best defined as: "${shortDef}"?`, 
                      options: formattedOptions, 
                      answer: correctAnswer 
                    });
                } else {
                    // Fallback to simple truncated fill in the blank
                    const words = s.split(' ');
                    const truncated = words.slice(0, 18).join(' ') + "...";
                    let optionsSet = new Set([targetWord]);
                    while(optionsSet.size < 4) {
                      optionsSet.add(betterDistractors[Math.floor(Math.random() * betterDistractors.length)]);
                    }
                    const optionsArr = Array.from(optionsSet).sort(() => Math.random() - 0.5);
                    const formattedOptions = [`A) ${optionsArr[0]}`, `B) ${optionsArr[1]}`, `C) ${optionsArr[2]}`, `D) ${optionsArr[3]}`];
                    const correctAnswer = formattedOptions.find((o) => o.includes(targetWord));
                    
                    generatedQuestions.push({ 
                      q: `Identify the core concept discussed: "${truncated.replace(new RegExp(bestTitle.split(' ')[0], 'gi'), '__________')}"`, 
                      options: formattedOptions, 
                      answer: correctAnswer 
                    });
                }
             }
          }
        } catch (e) {
          console.error("Wikipedia fetch failed for topic:", topic, e.message);
        }
      }
    }

    // 4. Fallback to generic questions to fulfill the minimum 5 questions requirement
    if (generatedQuestions.length < 5) {
       const shortTopic = text.substring(0, 30) || "this concept";
       const genericQuestions = [
         { q: `What is the primary function of ${shortTopic} in a modern technology stack?`, options: [`A) To manage core system architecture`, `B) To completely bypass network protocols`, `C) To manually compile binary code`, `D) To replace all front-end styling`], answer: `A) To manage core system architecture` },
         { q: `When implementing ${shortTopic}, what is a common challenge developers face?`, options: [`A) Ensuring proper configuration and integration`, `B) The absolute lack of documentation`, `C) It strictly requires quantum computers`, `D) It deletes the local hard drive`], answer: `A) Ensuring proper configuration and integration` },
         { q: `Which of the following describes the fundamental benefit of utilizing ${shortTopic}?`, options: [`A) Making systems completely untestable`, `B) Improving modularity and scalability`, `C) Hardcoding all variables permanently`, `D) Removing secure encryption`], answer: `B) Improving modularity and scalability` },
         { q: `In what scenario is the use of ${shortTopic} most critical?`, options: [`A) When deploying scalable applications`, `B) When writing basic plain text`, `C) When clearing system cache`, `D) When downgrading software`], answer: `A) When deploying scalable applications` },
         { q: `How does ${shortTopic} impact overall system reliability?`, options: [`A) By decreasing resource efficiency`, `B) By optimizing execution and stability`, `C) By halting background processes`, `D) By resetting application states randomly`], answer: `B) By optimizing execution and stability` }
       ];
       
       for (let g of genericQuestions) {
          if (generatedQuestions.length >= 5) break;
          if (!generatedQuestions.some(existing => existing.q === g.q)) {
             generatedQuestions.push(g);
          }
       }
    }

    const saved = await Promise.all(generatedQuestions.map(item => 
       Question.create({ sessionId, text: item.q, options: item.options, correctAnswer: item.answer })
    ));
    
    io.to(sessionId).emit("new-questions", saved);
    res.json({ questions: saved });
  } catch (err) {
    console.error("Critical fallback failed:", err.message);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

app.post("/api/manual-question", async (req, res) => {
  const { sessionId, text, options, correctAnswer } = req.body;
  try {
    const q = await Question.create({
      sessionId,
      text,
      options,
      correctAnswer
    });
    io.to(sessionId).emit("new-questions", [q]);
    res.json(q);
  } catch (err) {
    console.error("Manual question failed", err);
    res.status(500).json({ error: "Failed to broadcast manual question" });
  }
});

app.post("/api/answers", async (req, res) => {
  const { sessionId, questionId, studentName, text } = req.body;
  const question = await Question.findById(questionId);
  
  let isCorrect = false;
  let pointsEarned = 0;
  let timeTakenMs = 0;

  if (question) {
    isCorrect = (text === question.correctAnswer);
    timeTakenMs = Date.now() - new Date(question.createdAt).getTime();

    if (isCorrect) {
      // Base 50 points + up to 50 bonus points for speed (within 30 seconds)
      const maxBonus = 50;
      const timeLimitMs = 30000;
      let bonus = Math.floor(maxBonus * (1 - (timeTakenMs / timeLimitMs)));
      if (bonus < 0) bonus = 0;
      if (bonus > maxBonus) bonus = maxBonus;
      pointsEarned = 50 + bonus;
    }
  }

  const answer = await Answer.create({
    sessionId, questionId, studentName, text, isCorrect, timeTakenMs, pointsEarned
  });

  // Gamification: Update global student stats
  let student = await Student.findOne({ name: studentName });
  if (!student) {
    student = await Student.create({ name: studentName, sessionsAttended: [sessionId] });
  }
  student.totalScore += pointsEarned;
  if (!student.sessionsAttended.includes(sessionId)) student.sessionsAttended.push(sessionId);
  
  if (isCorrect && timeTakenMs < 5000 && !student.badges.includes("Lightning Fast ⚡")) {
    student.badges.push("Lightning Fast ⚡");
  }
  if (student.totalScore >= 500 && !student.badges.includes("Century Scholar 🏆")) {
    student.badges.push("Century Scholar 🏆");
  }
  await student.save();

  io.to(sessionId).emit("new-answer", answer);
  res.json(answer);
});

app.get("/api/students/:name/dashboard", async (req, res) => {
  const student = await Student.findOne({ name: req.params.name });
  if (!student) return res.status(404).json({ error: "Student not found" });
  
  const allAnswers = await Answer.find({ studentName: req.params.name });
  const correctCount = allAnswers.filter(a => a.isCorrect).length;
  const accuracy = allAnswers.length > 0 ? Math.round((correctCount / allAnswers.length) * 100) : 0;

  res.json({
    student,
    accuracy,
    answersCount: allAnswers.length,
    correctCount,
  });
});

// --- WebSockets ---
io.on("connection", (socket) => {
  socket.on("join-session", (id) => socket.join(id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));