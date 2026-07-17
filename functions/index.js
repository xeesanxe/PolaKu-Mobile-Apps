const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall, HttpsError} = require("firebase-functions/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
require("dotenv").config();
const Groq = require("groq-sdk");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

setGlobalOptions({maxInstances: 10});

initializeApp();
const db = getFirestore();

const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

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

  const {
    date, sleepHours, symptoms, mealFrequency,
    stressLevel, mood, inputMethod,
  } = request.data;

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

const NO_SYMPTOM_LABEL = "Tidak ada keluhan";
const NEGATIVE_MOODS = ["sedih", "marah", "kecewa", "cemas"];
const GROQ_INSIGHT_TIMEOUT_MS = 5000;
const DEFAULT_INSIGHT_TEXT =
  "Polamu minggu ini terlihat cukup seimbang. Terus jaga rutinitas ini, ya!";
const EMPTY_FLAGS = {
  low_sleep_symptom_flag: false,
  irregular_meal_flag: false,
  high_stress_flag: false,
  negative_mood_flag: false,
};

/**
 * Rule-based (deterministic) flag computation from up to 7 recent daily_logs.
 * @param {Array<Object>} logs Up to 7 most recent daily_logs docs for one user.
 * @return {{flags: Object, support: Object}} Computed flags and supporting
 *   numbers.
 */
function computeCorrelationFlags(logs) {
  const totalLogged = logs.length;

  const lowSleepDays = logs.filter((l) => l.sleepHours < 5);
  const lowSleepWithSymptoms = lowSleepDays.filter(
      (l) => Array.isArray(l.symptoms) &&
        l.symptoms.some((s) => s !== NO_SYMPTOM_LABEL),
  );
  const irregularMealDays = logs.filter((l) => l.mealFrequency < 3);
  const negativeMoodDays = logs.filter((l) => NEGATIVE_MOODS.includes(l.mood));
  const avgStress = totalLogged === 0 ?
    0 :
    logs.reduce((sum, l) => sum + (l.stressLevel || 0), 0) / totalLogged;

  return {
    flags: {
      low_sleep_symptom_flag:
        lowSleepDays.length >= 3 && lowSleepWithSymptoms.length >= 2,
      irregular_meal_flag: irregularMealDays.length >= 4,
      high_stress_flag: avgStress >= 70,
      negative_mood_flag: negativeMoodDays.length >= 4,
    },
    support: {
      totalLogged,
      lowSleepDaysCount: lowSleepDays.length,
      irregularMealDaysCount: irregularMealDays.length,
      avgStress: Math.round(avgStress),
      negativeMoodDaysCount: negativeMoodDays.length,
    },
  };
}

/**
 * Rule-based template sentence per active flag, used when LLM fails/times out.
 * @param {Object} flags Correlation flags from computeCorrelationFlags.
 * @param {Object} support Supporting numbers from computeCorrelationFlags.
 * @return {string} Fallback insight text, one sentence per active flag.
 */
function buildFallbackInsightText(flags, support) {
  const sentences = [];
  if (flags.low_sleep_symptom_flag) {
    sentences.push(
        `Tidur kamu di bawah 5 jam selama ${support.lowSleepDaysCount} ` +
        `dari ${support.totalLogged} hari terakhir, dan tampaknya ` +
        `berbarengan dengan gejala fisik.`,
    );
  }
  if (flags.irregular_meal_flag) {
    sentences.push(
        `Frekuensi makanmu kurang dari 3x terjadi pada ` +
        `${support.irregularMealDaysCount} dari ${support.totalLogged} ` +
        `hari terakhir.`,
    );
  }
  if (flags.high_stress_flag) {
    sentences.push(
        `Level stresmu rata-rata cukup tinggi (sekitar ${support.avgStress}) ` +
        `dalam ${support.totalLogged} hari terakhir.`,
    );
  }
  if (flags.negative_mood_flag) {
    sentences.push(
        `Mood negatif muncul pada ${support.negativeMoodDaysCount} dari ` +
        `${support.totalLogged} hari terakhir.`,
    );
  }
  return sentences.join(" ");
}

/**
 * Races a promise against a timer so a slow call can't block the caller
 * forever.
 * @param {Promise<*>} promise Promise to race against the timeout.
 * @param {number} ms Timeout in milliseconds.
 * @return {Promise<*>} Resolves/rejects with whichever settles first.
 */
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Groq call timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Sends only computed flags + supporting numbers to the LLM — never raw logs —
 * so the model rephrases verified facts instead of guessing patterns.
 * @param {Object} flags Correlation flags from computeCorrelationFlags.
 * @param {Object} support Supporting numbers from computeCorrelationFlags.
 * @return {Promise<string>} LLM-generated insight text.
 */
async function callGroqForInsight(flags, support) {
  const activeFlags = Object.entries(flags)
      .filter(([, active]) => active)
      .map(([key]) => key);

  const prompt = `Kamu adalah asisten kesehatan untuk mahasiswa. Berikut ` +
    `data pola hidup ${support.totalLogged} hari terakhir milik satu user ` +
    `(data ini sudah diverifikasi, bukan tebakan):
- Flag yang aktif: ${activeFlags.join(", ")}
- Hari dengan tidur < 5 jam: ${support.lowSleepDaysCount} dari ` +
    `${support.totalLogged} hari
- Hari dengan frekuensi makan < 3x: ${support.irregularMealDaysCount} dari ` +
    `${support.totalLogged} hari
- Rata-rata level stres (0-100): ${support.avgStress}
- Hari dengan mood negatif: ${support.negativeMoodDaysCount} dari ` +
    `${support.totalLogged} hari

Tulis 1-2 kalimat insight personal dalam Bahasa Indonesia yang natural ` +
    `dan suportif, HANYA berdasarkan data di atas. Jangan menambahkan ` +
    `asumsi, data lain, atau diagnosis medis.`;

  const completion = await groq.chat.completions.create({
    messages: [{role: "user", content: prompt}],
    model: "llama-3.3-70b-versatile",
  });

  return completion.choices[0].message.content.trim();
}

exports.generateDailyInsight = onDocumentWritten("daily_logs/{logId}",
    async (event) => {
      const snap = event.data && event.data.after;
      if (!snap || !snap.exists) {
        // Dokumen dihapus (event.data.after kosong) — tidak ada yg diproses.
        return;
      }

      const log = snap.data();
      const {userId, date} = log;

      try {
        const recentLogsSnap = await db.collection("daily_logs")
            .where("userId", "==", userId)
            .orderBy("date", "desc")
            .limit(7)
            .get();

        const logs = recentLogsSnap.docs.map((d) => d.data());
        const {flags, support} = computeCorrelationFlags(logs);
        const hasSignificantFlag = Object.values(flags).some(Boolean);

        let insightText;
        let source;

        if (!hasSignificantFlag) {
          insightText = DEFAULT_INSIGHT_TEXT;
          source = "default";
        } else {
          try {
            insightText = await withTimeout(
                callGroqForInsight(flags, support),
                GROQ_INSIGHT_TIMEOUT_MS,
            );
            source = "llm";
          } catch (llmError) {
            logger.error(
                "generateDailyInsight: Groq call failed/timeout, using " +
                "fallback",
                llmError,
            );
            insightText = buildFallbackInsightText(flags, support);
            source = "fallback";
          }
        }

        await db.collection("daily_insights").doc(`${userId}_${date}`).set({
          userId,
          date,
          insightText,
          triggeredFlags: flags,
          source,
          createdAt: FieldValue.serverTimestamp(),
        });

        logger.info("Daily insight generated", {userId, date, source});
      } catch (error) {
        logger.error(
            "generateDailyInsight: unexpected error, saving default insight",
            error,
        );
        try {
          await db.collection("daily_insights").doc(`${userId}_${date}`).set({
            userId,
            date,
            insightText: DEFAULT_INSIGHT_TEXT,
            triggeredFlags: EMPTY_FLAGS,
            source: "default",
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (fallbackError) {
          logger.error(
              "generateDailyInsight: failed to save default insight",
              fallbackError,
          );
        }
      }
    });
