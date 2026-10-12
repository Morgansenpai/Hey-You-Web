const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestsByUid = new Map();

function isRateLimited(uid) {
  const now = Date.now();
  const current = requestsByUid.get(uid);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestsByUid.set(uid, { startedAt: now, count: 1 });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return true;
  current.count += 1;
  return false;
}

function getAdminAuth() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error("Missing Firebase service account configuration.");

  if (!getApps().length) {
    const serviceAccount = JSON.parse(rawServiceAccount);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAuth();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Please sign in to generate audio." });
  }

  let adminAuth;
  try {
    adminAuth = getAdminAuth();
  } catch (error) {
    console.error("Firebase Admin configuration error:", error.message);
    return res.status(500).json({ error: "Server authentication is not configured." });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(match[1]);
  } catch (error) {
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }

  if (isRateLimited(decodedToken.uid)) {
    return res.status(429).json({ error: "Too many voice requests. Wait a minute and try again." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      return res.status(400).json({ error: "Invalid request body." });
    }
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "Write something first." });
  if (text.length > 5000) {
    return res.status(413).json({ error: "Your script is too long. Use 5,000 characters or fewer." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Voice generation is not configured on the server." });
  }

  const voiceId = typeof body.voice_id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(body.voice_id)
    ? body.voice_id
    : (process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8iKWAM");

  try {
    const upstream = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!upstream.ok) {
      const upstreamBody = await upstream.text();
      console.error("ElevenLabs request failed:", upstream.status, upstreamBody.slice(0, 500));
      let message = "Voice generation failed. Check the server configuration.";
      if (upstream.status === 401) message = "ElevenLabs rejected the API key. Check ELEVENLABS_API_KEY in Vercel.";
      else if (upstream.status === 403) message = "This ElevenLabs key does not have permission to use this voice or model.";
      else if (upstream.status === 404) message = "The configured ElevenLabs voice ID was not found.";
      else if (upstream.status === 422) message = "ElevenLabs rejected the voice request. Check the voice ID and model settings.";
      else if (upstream.status === 429) message = "ElevenLabs has reached a rate or usage limit. Check your account quota and try again.";
      else if (upstream.status === 402) message = "The ElevenLabs account has insufficient credits for this request.";
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: message, provider_status: upstream.status });
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(audio);
  } catch (error) {
    console.error("Voice generation error:", error.message);
    return res.status(502).json({ error: "Could not reach the voice service. Please try again." });
  }
};
