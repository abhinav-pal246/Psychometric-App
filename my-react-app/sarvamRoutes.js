// ── sarvamRoutes.js (ESM) ──
import express from "express";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const SARVAM_BASE = "https://api.sarvam.ai";

// ─────────────────────────────────────────────
// POST /api/sarvam/tts
// ─────────────────────────────────────────────
router.post("/tts", async (req, res) => {
  try {
    const { text, speaker = "priya" } = req.body;

    if (!text) return res.status(400).json({ error: "text is required" });

    const response = await fetch(`${SARVAM_BASE}/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        text,
        target_language_code: "en-IN",
        speaker,
        model: "bulbul:v3",
        pace: 1.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam TTS error:", response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    res.json({ audio: data.audios?.[0] || null });
  } catch (err) {
    console.error("TTS route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/sarvam/stt
// ─────────────────────────────────────────────
router.post("/stt", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "audio file is required" });

    // Use Node's built-in FormData (works with native fetch)
    const form = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype || "audio/wav",
    });
    form.append("file", blob, "recording.wav");
    form.append("model", "saarika:v2.5");
    form.append("language_code", "en-IN");

    const response = await fetch(`${SARVAM_BASE}/speech-to-text`, {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Sarvam STT error:", response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    res.json({ transcript: data.transcript || "" });
  } catch (err) {
    console.error("STT route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
