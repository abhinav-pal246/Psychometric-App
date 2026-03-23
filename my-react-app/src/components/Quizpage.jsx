import React, { useState, useRef } from "react";

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

// ── SVG Icons ──
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

// ── Helper: call backend /api/sarvam/tts → play audio ──
async function speakText(text) {
  const res = await fetch("/api/sarvam/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS request failed");
  const data = await res.json();
  if (!data.audio) throw new Error("No audio returned");

  const raw = atob(data.audio);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  return new Promise((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    audio.play();
  });
}

// ── Component ──
export default function Quizpage() {
  const [responses, setResponses] = useState({});
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const [playingQuestion, setPlayingQuestion] = useState(false);
  const [playingOptions, setPlayingOptions] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const [error, setError] = useState("");

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

  const resetAudio = () => {
    setPlayingQuestion(false);
    setPlayingOptions(false);
    stopRecordingSilently();
  };

  const goNext = () => { if (!isLast) { setDirection(1); resetAudio(); setCurrent((p) => p + 1); } };
  const goPrev = () => { if (!isFirst) { setDirection(-1); resetAudio(); setCurrent((p) => p - 1); } };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  };

  // ── TTS: Question ──
  const handleTTSQuestion = async () => {
    if (playingQuestion) return;
    setPlayingQuestion(true);
    setPlayingOptions(false);
    try {
      await speakText(questions[current]);
    } catch (err) {
      console.error(err);
      showError("Failed to play question audio.");
    }
    setPlayingQuestion(false);
  };

  // ── TTS: Options ──
  const handleTTSOptions = async () => {
    if (playingOptions) return;
    setPlayingOptions(true);
    setPlayingQuestion(false);
    try {
      const text = options.map((o, i) => `Option ${i}: ${o}`).join(". ");
      await speakText(text);
    } catch (err) {
      console.error(err);
      showError("Failed to play options audio.");
    }
    setPlayingOptions(false);
  };

  // ── STT: Start ──
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

  // ── STT: Stop → transcribe ──
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

  // ── Render ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 flex flex-col font-['Outfit',_sans-serif]">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap" rel="stylesheet" />

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium shadow-lg animate-bounce">
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

          {/* Card */}
          <div key={current} className="bg-white rounded-3xl shadow-xl shadow-teal-100/30 border border-teal-100/50 overflow-hidden transition-all duration-300">

            {/* ── QUESTION SECTION ── */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-bold text-sm shadow-lg shadow-teal-200/40">
                  {String(current + 1).padStart(2, "0")}
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">Question {current + 1} of {questions.length}</span>
              </div>

              <p className="text-lg text-slate-700 leading-relaxed font-medium mb-5 font-['Fraunces',_serif]">
                {questions[current]}
              </p>

              {/* 🔊 Listen to Question */}
              <button
                onClick={handleTTSQuestion}
                disabled={playingQuestion}
                className={`
                  inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border
                  ${playingQuestion
                    ? "bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-200/50 cursor-wait"
                    : "bg-teal-50 text-teal-600 border-teal-200/60 hover:bg-teal-100 hover:border-teal-300"
                  }
                `}
              >
                <span className={playingQuestion ? "animate-pulse" : ""}>
                  <SpeakerIcon size={15} />
                </span>
                {playingQuestion ? "Playing Question…" : "Listen to Question"}
              </button>
            </div>

            {/* Divider */}
            <div className="mx-7 h-px bg-gradient-to-r from-transparent via-teal-200/50 to-transparent" />

            {/* ── OPTIONS SECTION ── */}
            <div className="px-7 pt-5 pb-0">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Response Options</p>
                <button
                  onClick={handleTTSOptions}
                  disabled={playingOptions}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border
                    ${playingOptions
                      ? "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-200/50 cursor-wait"
                      : "bg-indigo-50 text-indigo-500 border-indigo-200/60 hover:bg-indigo-100 hover:border-indigo-300"
                    }
                  `}
                >
                  <span className={playingOptions ? "animate-pulse" : ""}>
                    <SpeakerIcon size={13} />
                  </span>
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

            {/* Divider */}
            <div className="mx-7 mt-4 h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

            {/* ── YOUR ANSWER ── */}
            <div className="px-7 pt-5 pb-7">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Your Answer</p>

                {/* 🎤 Speak Answer */}
                <button
                  onClick={toggleSTT}
                  disabled={sttLoading}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border
                    ${sttLoading
                      ? "bg-amber-50 text-amber-600 border-amber-200 cursor-wait"
                      : isListening
                        ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200/50 animate-pulse"
                        : "bg-rose-50 text-rose-500 border-rose-200/60 hover:bg-rose-100 hover:border-rose-300"
                    }
                  `}
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
                  placeholder="Type your response here or click 'Speak Answer' to use your voice…"
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
              <button className={`flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                answered === questions.length
                  ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-200/50 hover:shadow-xl hover:scale-105"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}>
                Submit
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