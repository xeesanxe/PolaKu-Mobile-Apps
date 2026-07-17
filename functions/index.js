const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall, HttpsError} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
require("dotenv").config();
const Groq = require("groq-sdk");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

setGlobalOptions({maxInstances: 10});

initializeApp();
const db = getFirestore();

const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

// Import voiceExtract dari file terpisah
const {voiceExtract} = require("./src/voiceExtract");

exports.testGroqConnection = onRequest(async (req, res) => {
  try {
    const completion = await groq.chat.completions.create({
      messages: [{role: "user", content: "Bilang halo dalam satu kalimat"}],
      model: "llama-3.3-70b-versatile",
    });
    logger.info("Groq connection success");
    res.json({
      status: "ok",
      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    logger.error("Groq connection failed", error);
    res.status(500).json({status: "error", message: error.message});
  }
});

exports.saveDailyLog = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User harus login.");
  }
  const userId = request.auth.uid;

  const {date, sleepHours, symptoms, mealFrequency, stressLevel, mood, inputMethod} = request.data;

  if (!date || sleepHours == null || mealFrequency == null ||
      stressLevel == null || !mood || !inputMethod) {
    throw new HttpsError("invalid-argument", "Field wajib belum lengkap.");
  }

  const docId = `${userId}_${date}`;
  const docRef = db.collection("daily_logs").doc(docId);

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);

    const logData = {
      userId,
      date,
      sleepHours,
      symptoms: symptoms || [],
      mealFrequency,
      stressLevel,
      mood,
      inputMethod,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (doc.exists) {
      transaction.set(docRef, logData, {merge: true});
      return {logId: docId, status: "updated"};
    } else {
      logData.createdAt = FieldValue.serverTimestamp();
      transaction.set(docRef, logData);
      return {logId: docId, status: "saved"};
    }
  });

  logger.info("Daily log saved", {docId, status: result.status});
  return result;
});

// Export voiceExtract
exports.voiceExtract = voiceExtract;