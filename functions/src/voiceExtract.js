const { onCall, HttpsError } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYMPTOM_KEYWORDS = [
  "Pusing",
  "Maag/asam lambung kambuh",
  "Capek berlebihan/mudah lelah",
  "Susah tidur/insomnia",
  "Mata lelah/sakit kepala",
  "Nyeri otot/pegal",
  "Tidak ada keluhan",
];

const REQUIRED_FIELDS = ["sleepHours", "symptoms", "mealFrequency", "stressLevel", "mood"];

function bufferFromBase64(base64Audio) {
  return Buffer.from(base64Audio, "base64");
}

async function transcribeAudio(audioBuffer) {
  const file = new File([audioBuffer], "voice-note.m4a", { type: "audio/m4a" });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    language: "id",
    response_format: "text",
  });

  return typeof transcription === "string" ? transcription : transcription.text;
}

async function extractFieldsFromTranscript(transcript) {
  const systemPrompt = `Kamu adalah asisten ekstraksi data kesehatan untuk mahasiswa.
Dari transkrip curhat suara berikut, ekstrak HANYA 5 field ini jika disebutkan secara eksplisit atau bisa disimpulkan wajar:
- sleepHours (number, jam tidur semalam)
- symptoms (array of string, pilih HANYA dari daftar ini: ${SYMPTOM_KEYWORDS.join(", ")})
- mealFrequency (number, berapa kali makan hari ini)
- stressLevel (number, 0-100, perkirakan dari nada bicara/kata-kata)
- mood (string, salah satu: senang, biasa, sedih, marah, kecewa, cemas)

Field yang TIDAK disebutkan atau tidak bisa disimpulkan, JANGAN diisi (jangan menebak paksa).
Abaikan bagian cerita yang tidak relevan dengan 5 field di atas.
Balas HANYA dalam format JSON: {"extractedFields": {...hanya field yang berhasil diekstrak...}, "confidence": "high"|"medium"|"low"}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return parsed;
}

exports.voiceExtract = onCall(
  { timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User harus login.");
    }

    const { audioBase64 } = request.data;
    if (!audioBase64) {
      throw new HttpsError("invalid-argument", "Audio tidak ditemukan.");
    }

    let transcript;
    try {
      const audioBuffer = bufferFromBase64(audioBase64);
      transcript = await transcribeAudio(audioBuffer);

      if (!transcript || transcript.trim().length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Rekaman tidak dapat diproses, coba rekam ulang atau gunakan mode pilihan."
        );
      }
    } catch (err) {
      logger.error("voiceExtract: STT gagal", err);
      throw new HttpsError(
        "internal",
        "Rekaman tidak dapat diproses, coba rekam ulang atau gunakan mode pilihan."
      );
    }

    let extracted;
    try {
      extracted = await extractFieldsFromTranscript(transcript);
    } catch (err) {
      logger.error("voiceExtract: ekstraksi LLM gagal", err);
      throw new HttpsError(
        "internal",
        "Gagal memproses hasil rekaman. Silakan gunakan mode pilihan."
      );
    }

    const extractedFields = extracted.extractedFields || {};
    const missingFields = REQUIRED_FIELDS.filter(
      (field) => extractedFields[field] === undefined || extractedFields[field] === null
    );

    logger.info("voiceExtract: berhasil", {
      userId: request.auth.uid,
      missingFields,
      confidence: extracted.confidence,
    });

    return {
      transcript,
      extractedFields,
      confidence: extracted.confidence || "low",
      missingFields,
    };
  }
);