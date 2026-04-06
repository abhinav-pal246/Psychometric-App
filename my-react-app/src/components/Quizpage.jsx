import React, { useState, useRef, useEffect, useCallback } from "react";

const questions = [
  "In the last month, how often have you been upset because of something that happened unexpectedly?",
  "In the last month, how often have you felt that you were unable to control the important things in your life?",
  "In the last month, how often have you felt nervous and stressed?",
  "In the last month, how often have you felt confident about your ability to handle your personal problems?",
  "In the last month, how often have you felt that things were going your way?",
  "In the last month, how often have you found that you could not cope with all the things that you had to do?",
  "In the last month, how often have you been able to control irritations in your life?",
  "In the last month, how often have you felt that you were on top of things?",
  "In the last month, how often have you been angered because of things that were outside of your control?",
  "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",
];

const options = ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"];

// Questions 4,5,7,8 are reversed (1-indexed) → 0-indexed: 3,4,6,7
const REVERSED_QUESTIONS = [3, 4, 6, 7];

// ── Score Helpers ──────────────────────────────────────────
const calculateScore = (questionIndex, answer) => {
  if (REVERSED_QUESTIONS.includes(questionIndex)) {
    return 4 - answer; // reverse: 0→4, 1→3, 2→2, 3→1, 4→0
  }
  return answer; // normal: score = answer as-is
};

// ── Answer Text → Number (0-4) ─────────────────────────────
const parseAnswerToValue = (text) => {
  const cleaned = text.toLowerCase().trim();

  // Direct number match
  if (cleaned === "0") return 0;
  if (cleaned === "1") return 1;
  if (cleaned === "2") return 2;
  if (cleaned === "3") return 3;
  if (cleaned === "4") return 4;

  // Text match — check "almost never" before "never" to avoid partial match
  if (cleaned.includes("almost never")) return 1;
  if (cleaned.includes("never"))        return 0;
  if (cleaned.includes("sometimes"))    return 2;
  if (cleaned.includes("fairly often")) return 3;
  if (cleaned.includes("very often"))   return 4;

  return null; // couldn't parse
};

// ── SVG Icons ──────────────────────────────────────────────
function SpeakerIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MicIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="1" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function StopIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

// ── TTS Helper with AbortController support ──
// signal: AbortSignal — cancels the fetch AND stops playback
async function speakText(text, audioRef, signal) {
  const res = await fetch("/api/sarvam/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error("TTS request failed");
  const data = await res.json();
  if (!data.audio) throw new Error("No audio returned");

  // Check if aborted during JSON parse
  if (signal && signal.aborted) return;

  const raw = atob(data.audio);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  if (audioRef) audioRef.current = audio;

  return new Promise((resolve) => {
    const cleanup = () => { URL.revokeObjectURL(url); if (audioRef) audioRef.current = null; resolve(); };

    // If already aborted before play, don't play
    if (signal && signal.aborted) { cleanup(); return; }

    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play();

    // Listen for abort to stop mid-playback
    if (signal) {
      signal.addEventListener("abort", () => {
        audio.pause();
        audio.currentTime = 0;
        cleanup();
      }, { once: true });
    }
  });
}

// ── Stop any playing TTS audio ──
function stopTTS(audioRef) {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  }
}

// ── Component ──────────────────────────────────────────────
export default function Quizpage() {
  const [responses, setResponses] = useState({});
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [playingQuestion, setPlayingQuestion] = useState(false);
  const [playingOptions, setPlayingOptions] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const [error, setError] = useState("");

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // ── Audio ref for stopping TTS ──
  const ttsAudioRef = useRef(null);

  // ── AbortController for cancelling in-flight TTS fetches + playback ──
  const abortControllerRef = useRef(null);

  // ── Click detection refs ──
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  const prevQuestionRef = useRef(current);

  // ── Track if TTS sequence is active (UI state for toggle) ──
  const ttsActiveRef = useRef(false);

  const answered = Object.keys(responses).filter((k) => responses[k].trim() !== "").length;
  const progress = ((current + 1) / questions.length) * 100;
  const isFirst = current === 0;
  const isLast = current === questions.length - 1;

  const handleInputChange = (value) => {
    setResponses((prev) => ({ ...prev, [current]: value }));
  };

  const stopRecordingSilently = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsListening(false);
  };

  // ── Cancel all in-flight fetches + playing audio + recording ──
  const cancelAll = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    ttsActiveRef.current = false;
    stopTTS(ttsAudioRef);
    setIsTTSPlaying(false);
    setPlayingQuestion(false);
    setPlayingOptions(false);
    stopRecordingSilently();
  };

  // ── Get a fresh AbortSignal (cancels any previous one first) ──
  const newSignal = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller.signal;
  };

  const resetAudio = cancelAll;

  const goNext = useCallback(() => {
    setCurrent((prev) => {
      if (prev < questions.length - 1) {
        setDirection(1);
        resetAudio();
        return prev + 1;
      }
      return prev;
    });
  }, []);

  const goPrev = useCallback(() => {
    setCurrent((prev) => {
      if (prev > 0) {
        setDirection(-1);
        resetAudio();
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  };

  // ══════════════════════════════════════════════════════════
  // FEATURE 1: Announce question number on switch via Sarvam TTS
  // On last question, announce "This is the last question"
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    if (prevQuestionRef.current === current && current === 0 && prevQuestionRef.current === 0) {
      // Initial mount — announce question 1
    } else if (prevQuestionRef.current === current) {
      return; // no change
    }
    prevQuestionRef.current = current;

    const announceQuestion = async () => {
      // Cancel any ongoing TTS (including in-flight fetches)
      cancelAll();

      let announcement;
      if (current === questions.length - 1) {
        announcement = `Question ${current + 1}. This is the last question.`;
      } else {
        announcement = `Question ${current + 1}.`;
      }

      const signal = newSignal();
      try {
        await speakText(announcement, ttsAudioRef, signal);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Question announcement failed:", err);
      }
    };

    announceQuestion();
  }, [current]);

  // ══════════════════════════════════════════════════════════
  // FEATURE 2: Keyboard left/right arrow to change question
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in textarea
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // ══════════════════════════════════════════════════════════
  // FEATURE 3: Single click → TTS read question+options+answer / stop if playing
  // FEATURE 4: Double click → STT to take voice answer
  // FEATURE 5: Triple click → Clear the submitted answer
  // Clicks are detected on the ENTIRE window via window event listener.
  // ══════════════════════════════════════════════════════════

  // Store latest state in refs so the window click handler always reads fresh values
  const currentRef = useRef(current);
  const responsesRef = useRef(responses);
  currentRef.current = current;
  responsesRef.current = responses;

  useEffect(() => {
    const handleWindowClick = (e) => {
      // Don't trigger on button clicks, textarea, or interactive elements
      if (
        e.target.tagName === "BUTTON" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "INPUT" ||
        e.target.closest("button") ||
        e.target.closest("textarea")
      ) {
        return;
      }

      clickCountRef.current += 1;

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }

      clickTimerRef.current = setTimeout(() => {
        const clicks = clickCountRef.current;
        clickCountRef.current = 0;

        if (clicks === 1) {
          handleSingleClick();
        } else if (clicks === 2) {
          handleDoubleClick();
        } else if (clicks >= 3) {
          handleTripleClick();
        }
      }, 350);
    };

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []); // empty deps — uses refs for fresh state

  // ── SINGLE CLICK: Read question + options + user's answer via TTS / Stop if playing ──
  const handleSingleClick = async () => {
    // If TTS is currently active (playing or fetching), just stop everything
    if (ttsActiveRef.current) {
      cancelAll();
      return;
    }

    // Stop any other ongoing task first (STT, recording, in-flight fetches)
    cancelAll();

    // Start TTS sequence with a fresh abort signal
    const signal = newSignal();
    ttsActiveRef.current = true;
    setIsTTSPlaying(true);
    setPlayingQuestion(true);

    const cur = currentRef.current;

    try {
      // Read question
      await speakText(`Question ${cur + 1}. ${questions[cur]}`, ttsAudioRef, signal);
      if (signal.aborted) return;

      setPlayingQuestion(false);
      setPlayingOptions(true);

      // Read options
      const optionsText = options.map((o, i) => `Option ${i}: ${o}`).join(". ");
      await speakText(optionsText, ttsAudioRef, signal);
      if (signal.aborted) return;

      setPlayingOptions(false);

      // Read user's answer if they have one
      const userAnswer = responsesRef.current[cur];
      if (userAnswer && userAnswer.trim() !== "") {
        const parsed = parseAnswerToValue(userAnswer);
        if (parsed !== null) {
          await speakText(`Your answer is: ${options[parsed]}`, ttsAudioRef, signal);
        } else {
          await speakText(`Your current answer is: ${userAnswer}`, ttsAudioRef, signal);
        }
        if (signal.aborted) return;
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("TTS error:", err);
        if (ttsActiveRef.current) showError("Failed to play audio.");
      }
    }

    ttsActiveRef.current = false;
    setIsTTSPlaying(false);
    setPlayingQuestion(false);
    setPlayingOptions(false);
  };

  // ── DOUBLE CLICK: Start STT, auto-stop on valid answer, reset on invalid ──
  const handleDoubleClick = async () => {
    // Stop everything first (TTS, any previous recording, in-flight fetches)
    cancelAll();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(250);
      setIsListening(true);

      // Auto-stop after 6 seconds of recording
      setTimeout(async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          await autoStopAndValidate();
        }
      }, 6000);
    } catch (err) {
      console.error(err);
      showError("Microphone access denied. Please allow mic permissions.");
    }
  };

  // Auto-stop recording and validate the answer
  const autoStopAndValidate = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      setIsListening(false);
      return;
    }

    setIsListening(false);
    setSttLoading(true);

    const cur = currentRef.current;

    try {
      const blob = await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => {
          resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        };
        mediaRecorderRef.current.stop();
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;

      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      const res = await fetch("/api/sarvam/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("STT request failed");

      const data = await res.json();
      if (data.transcript) {
        const transcript = data.transcript.trim();
        const parsed = parseAnswerToValue(transcript);

        if (parsed !== null) {
          setResponses((prev) => ({ ...prev, [cur]: options[parsed] }));
          const signal = newSignal();
          ttsActiveRef.current = true;
          try {
            await speakText(`Answer recorded: ${options[parsed]}`, ttsAudioRef, signal);
          } catch (err) {
            if (err.name !== "AbortError") console.error(err);
          }
          ttsActiveRef.current = false;
        } else {
          setResponses((prev) => ({ ...prev, [cur]: "" }));
          const signal = newSignal();
          ttsActiveRef.current = true;
          try {
            await speakText("Answer was not from the following options. Please try answering again.", ttsAudioRef, signal);
          } catch (err) {
            if (err.name !== "AbortError") console.error(err);
          }
          ttsActiveRef.current = false;
        }
      }
    } catch (err) {
      console.error(err);
      showError("Failed to transcribe. Please try again.");
    }

    setSttLoading(false);
  };

  // ── TRIPLE CLICK: Clear the submitted answer ──
  const handleTripleClick = async () => {
    // Stop everything first
    cancelAll();

    setResponses((prev) => ({ ...prev, [currentRef.current]: "" }));

    // Announce that the answer has been cleared
    const signal = newSignal();
    ttsActiveRef.current = true;
    try {
      await speakText("Answer cleared.", ttsAudioRef, signal);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
    ttsActiveRef.current = false;
  };

  // ── TTS: Question (button) ──
  const handleTTSQuestion = async () => {
    if (playingQuestion) return;
    cancelAll();
    const signal = newSignal();
    setPlayingQuestion(true);
    setIsTTSPlaying(true);
    ttsActiveRef.current = true;
    try {
      await speakText(questions[current], ttsAudioRef, signal);
    } catch (err) {
      if (err.name !== "AbortError") { console.error(err); showError("Failed to play question audio."); }
    }
    setPlayingQuestion(false);
    setIsTTSPlaying(false);
    ttsActiveRef.current = false;
  };

  // ── TTS: Options (button) ──
  const handleTTSOptions = async () => {
    if (playingOptions) return;
    cancelAll();
    const signal = newSignal();
    setPlayingOptions(true);
    setIsTTSPlaying(true);
    ttsActiveRef.current = true;
    try {
      const text = options.map((o, i) => `Option ${i}: ${o}`).join(". ");
      await speakText(text, ttsAudioRef, signal);
    } catch (err) {
      if (err.name !== "AbortError") { console.error(err); showError("Failed to play options audio."); }
    }
    setPlayingOptions(false);
    setIsTTSPlaying(false);
    ttsActiveRef.current = false;
  };

  // ── STT: Toggle (button) ──
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(250);
      setIsListening(true);
    } catch (err) {
      console.error(err);
      showError("Microphone access denied. Please allow mic permissions.");
    }
  };

  const stopAndTranscribe = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      setIsListening(false);
      return;
    }

    setIsListening(false);
    setSttLoading(true);

    try {
      const blob = await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => {
          resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        };
        mediaRecorderRef.current.stop();
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;

      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      const res = await fetch("/api/sarvam/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("STT request failed");

      const data = await res.json();
      if (data.transcript) {
        setResponses((prev) => {
          const existing = (prev[current] || "").trim();
          return { ...prev, [current]: existing ? existing + " " + data.transcript : data.transcript };
        });
      }
    } catch (err) {
      console.error(err);
      showError("Failed to transcribe. Please try again.");
    }

    setSttLoading(false);
  };

  const toggleSTT = () => {
    if (isListening) stopAndTranscribe();
    else startListening();
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    const responsesArray = [];
    for (let i = 0; i < questions.length; i++) {
      const rawText = (responses[i] || "").trim();
      const value = parseAnswerToValue(rawText);

      if (value === null) {
        showError(
          `Question ${i + 1}: "${rawText}" is not a valid answer. Please type or say: Never, Almost Never, Sometimes, Fairly Often, or Very Often.`
        );
        setCurrent(i);
        return;
      }

      responsesArray.push({
        question_id: i + 1,
        answer: value,
        score: calculateScore(i, value),
      });
    }

    const totalScore = responsesArray.reduce((sum, r) => sum + r.score, 0);

    try {
      setSubmitting(true);
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          responses: responsesArray,
          total_score: totalScore,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitResult({ total_score: totalScore, attemptId: data.attemptId });
        setSubmitted(true);
      } else {
        showError(data.error || "Submission failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      showError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stress Level Label ──
  const getStressLabel = (score) => {
    if (score <= 13) return { label: "Low Stress", color: "text-green-600", bg: "bg-green-50 border-green-200" };
    if (score <= 26) return { label: "Moderate Stress", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
    return { label: "High Stress", color: "text-red-600", bg: "bg-red-50 border-red-200" };
  };

  // ── Success Screen ─────────────────────────────────────────
  if (submitted && submitResult) {
    const stress = getStressLabel(submitResult.total_score);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 flex items-center justify-center px-5 font-['Outfit',_sans-serif]">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap" rel="stylesheet" />
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-teal-100/50 p-10 text-center">
          {/* Checkmark */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-200/50">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2 font-['Fraunces',_serif]">Quiz Submitted!</h2>
          <p className="text-slate-400 text-sm mb-8">Your responses have been saved successfully.</p>

          {/* Score */}
          <div className="bg-slate-50 rounded-2xl p-6 mb-4 border border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Your PSS-10 Score</p>
            <p className="text-5xl font-bold text-slate-800 mb-1">{submitResult.total_score}</p>
            <p className="text-xs text-slate-400">out of 40</p>
          </div>

          {/* Stress Level */}
          <div className={`rounded-2xl px-6 py-4 border ${stress.bg}`}>
            <p className={`text-lg font-semibold ${stress.color}`}>{stress.label}</p>
            <p className="text-xs text-slate-400 mt-1">
              {submitResult.total_score <= 13
                ? "Scores 0–13 indicate low perceived stress."
                : submitResult.total_score <= 26
                ? "Scores 14–26 indicate moderate perceived stress."
                : "Scores 27–40 indicate high perceived stress."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Quiz Render ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 flex flex-col font-['Outfit',_sans-serif]">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap" rel="stylesheet" />

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium shadow-lg max-w-sm text-center">
          {error}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-teal-100/60">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md shadow-teal-200/50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800 leading-tight font-['Fraunces',_serif]">PSS-10</h1>
              <p className="text-xs text-slate-400 font-light tracking-wide">Perceived Stress Scale</p>
            </div>
          </div>
          <span className="text-xs font-medium text-teal-600 tabular-nums">{answered} of {questions.length} answered</span>
        </div>
        <div className="h-1 bg-teal-50">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Accessibility hint banner */}
      <div className="max-w-2xl mx-auto w-full px-5 pt-4">
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-500 font-medium flex items-center gap-2">
          <span>⌨</span>
          <span>
            <strong>Shortcuts:</strong> Arrow keys = navigate  |  Single click = read aloud / stop  |  Double click = speak answer  |  Triple click = clear answer
          </span>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-2xl">

          {/* Dot nav */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); resetAudio(); setCurrent(i); }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-gradient-to-r from-teal-500 to-cyan-500 scale-125 shadow-md shadow-teal-300/50"
                    : responses[i] && responses[i].trim() !== "" ? "bg-teal-300" : "bg-slate-200 hover:bg-slate-300"
                }`}
                title={`Question ${i + 1}`}
              />
            ))}
          </div>

          {/* Card — click handler for single/double/triple click */}
          <div
            key={current}
            className="bg-white rounded-3xl shadow-xl shadow-teal-100/30 border border-teal-100/50 overflow-hidden transition-all duration-300 cursor-pointer select-none"
            role="region"
            aria-label={`Question ${current + 1} of ${questions.length}`}
          >

            {/* TTS Playing Indicator */}
            {isTTSPlaying && (
              <div className="bg-teal-500 text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-2">
                <span className="animate-pulse">●</span> Reading aloud — click to stop
              </div>
            )}

            {/* Listening Indicator */}
            {isListening && (
              <div className="bg-rose-500 text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-2">
                <span className="animate-pulse">●</span> Listening for your answer…
              </div>
            )}

            {/* QUESTION SECTION */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-bold text-sm shadow-lg shadow-teal-200/40">
                  {String(current + 1).padStart(2, "0")}
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
                  Question {current + 1} of {questions.length}
                  {isLast && <span className="ml-2 text-rose-500 font-bold">(Last Question)</span>}
                </span>
              </div>

              <p className="text-lg text-slate-700 leading-relaxed font-medium mb-5 font-['Fraunces',_serif]">
                {questions[current]}
              </p>

              <button
                onClick={handleTTSQuestion}
                disabled={playingQuestion}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                  playingQuestion
                    ? "bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-200/50 cursor-wait"
                    : "bg-teal-50 text-teal-600 border-teal-200/60 hover:bg-teal-100 hover:border-teal-300"
                }`}
              >
                <span className={playingQuestion ? "animate-pulse" : ""}><SpeakerIcon size={15} /></span>
                {playingQuestion ? "Playing Question…" : "Listen to Question"}
              </button>
            </div>

            <div className="mx-7 h-px bg-gradient-to-r from-transparent via-teal-200/50 to-transparent" />

            {/* OPTIONS SECTION */}
            <div className="px-7 pt-5 pb-0">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Response Options</p>
                <button
                  onClick={handleTTSOptions}
                  disabled={playingOptions}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                    playingOptions
                      ? "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-200/50 cursor-wait"
                      : "bg-indigo-50 text-indigo-500 border-indigo-200/60 hover:bg-indigo-100 hover:border-indigo-300"
                  }`}
                >
                  <span className={playingOptions ? "animate-pulse" : ""}><SpeakerIcon size={13} /></span>
                  {playingOptions ? "Playing…" : "Listen to Options"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-600">
                    <span className="w-6 h-6 rounded-md bg-slate-200/70 flex items-center justify-center text-xs font-bold text-slate-400">{oi}</span>
                    <span className="text-sm font-medium">{opt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-7 mt-4 h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

            {/* YOUR ANSWER */}
            <div className="px-7 pt-5 pb-7">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Your Answer</p>

                <button
                  onClick={toggleSTT}
                  disabled={sttLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                    sttLoading
                      ? "bg-amber-50 text-amber-600 border-amber-200 cursor-wait"
                      : isListening
                        ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200/50 animate-pulse"
                        : "bg-rose-50 text-rose-500 border-rose-200/60 hover:bg-rose-100 hover:border-rose-300"
                  }`}
                >
                  {sttLoading ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                      </svg>
                      Transcribing…
                    </>
                  ) : isListening ? (
                    <>
                      <StopIcon size={13} />
                      Stop &amp; Transcribe
                      <span className="flex gap-0.5 items-end ml-1">
                        <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" />
                        <span className="w-0.5 h-4 bg-white rounded-full animate-bounce delay-75" />
                        <span className="w-0.5 h-3 bg-white rounded-full animate-bounce delay-150" />
                        <span className="w-0.5 h-5 bg-white rounded-full animate-bounce delay-100" />
                        <span className="w-0.5 h-3 bg-white rounded-full animate-bounce delay-200" />
                      </span>
                    </>
                  ) : (
                    <>
                      <MicIcon size={13} />
                      Speak Answer
                    </>
                  )}
                </button>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={responses[current] || ""}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Say or type: Never / Almost Never / Sometimes / Fairly Often / Very Often"
                  rows={3}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-sm text-slate-700 placeholder-slate-300 leading-relaxed resize-none transition-all duration-200 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 focus:bg-white font-['Outfit',_sans-serif]"
                />
                {responses[current] && responses[current].trim() !== "" && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>
                )}
              </div>

              {/* Live parsed value preview */}
              {responses[current] && responses[current].trim() !== "" && (() => {
                const val = parseAnswerToValue(responses[current]);
                return val !== null ? (
                  <p className="mt-2 text-xs text-teal-600 font-medium">
                    ✓ Parsed as: <span className="font-bold">{options[val]}</span> (score: {val})
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-red-500 font-medium">
                    ✗ Not recognized. Say: Never / Almost Never / Sometimes / Fairly Often / Very Often
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 px-2">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isFirst ? "text-slate-300 cursor-not-allowed" : "text-slate-500 hover:text-teal-600 hover:bg-white/80 hover:shadow-sm"
              }`}
            >
              <ChevronLeft /> Previous
            </button>

            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={answered !== questions.length || submitting}
                className={`flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  answered === questions.length && !submitting
                    ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-200/50 hover:shadow-xl hover:scale-105"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            ) : (
              <button onClick={goNext} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-teal-600 hover:bg-white/80 hover:shadow-sm transition-all duration-200">
                Next <ChevronRight />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
