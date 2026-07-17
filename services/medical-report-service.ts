import { generateMedicalReportPDF, DailyLogData } from './pdf-report-generator';

/**
 * Hook untuk generate dan download medical report PDF
 * Usage: const { generatePDF, isLoading, error } = useMedicalReportPDF();
 */

// Data sample (sesuai dengan JSON yang sudah dibuat)
export const SAMPLE_HEALTH_LOG_DATA: DailyLogData = {
  patientId: "USR-948210",
  period: "11 Juli 2026 – 17 Juli 2026",
  averages: {
    sleepHours: 5.93,
    mealFrequency: 2.71,
    stressLevel: 6.43,
    dominantMood: "Anxious"
  },
  dailyLogs: [
    {
      date: "2026-07-11",
      sleepHours: 7.5,
      mealFrequency: 3,
      stressLevel: 3,
      mood: "Calm",
      symptoms: ["Tidak ada keluhan"],
      voiceNoteTranscript: "Hari ini terasa biasa saja. Tidur malam yang cukup, bangun segar. Makan pagi normal, makan siang dengan teman di kantin, makan malam santai di rumah. Tidak ada keluhan kesehatan yang berarti."
    },
    {
      date: "2026-07-12",
      sleepHours: 7.2,
      mealFrequency: 3,
      stressLevel: 4,
      mood: "Neutral",
      symptoms: ["Tidak ada keluhan"],
      voiceNoteTranscript: "Hari yang produktif. Tidur normal kemarin, bangun dengan energi penuh. Sarapan dengan telur dan roti, makan siang nasi goreng di warung, makan malam dengan keluarga."
    },
    {
      date: "2026-07-13",
      sleepHours: 4.8,
      mealFrequency: 2,
      stressLevel: 7.5,
      mood: "Anxious",
      symptoms: ["Asam lambung naik", "Pusing ringan", "Kelelahan fisik (fatigue)"],
      voiceNoteTranscript: "Hari yang sangat berat. Mendapat email bahwa deadline utama project dipercepat menjadi empat hari. Mulai jam 9 pagi langsung kerja non-stop. Lupa sarapan, skip makan siang, baru makan jam 5 sore."
    },
    {
      date: "2026-07-14",
      sleepHours: 5.0,
      mealFrequency: 2,
      stressLevel: 8.2,
      mood: "Stressed",
      symptoms: ["Migrain akut", "Asam lambung naik", "Palpitasi", "Kelelahan fisik (fatigue)"],
      voiceNoteTranscript: "Hari terburuk minggu ini. Bangun jam 6 pagi dengan migrain yang parah. Tekanan kerja meningkat drastis, 60% project belum selesai sedang tinggal 3 hari."
    },
    {
      date: "2026-07-15",
      sleepHours: 6.0,
      mealFrequency: 3,
      stressLevel: 6.8,
      mood: "Anxious",
      symptoms: ["Asam lambung naik", "Pusing ringan", "Mata lelah (eye strain)"],
      voiceNoteTranscript: "Mulai ada perbaikan tapi masih tegang. Bangun jam 7 pagi, migrain sudah menghilang tapi kepala masih terasa berat. Makan paracetamol sekali lagi."
    },
    {
      date: "2026-07-16",
      sleepHours: 6.8,
      mealFrequency: 3,
      stressLevel: 5.0,
      mood: "Neutral",
      symptoms: ["Mata lelah (eye strain)", "Pusing ringan"],
      voiceNoteTranscript: "Hari yang jauh lebih baik. Tidur semalam lumayan nyenyak dapat 6.5 jam. Bangun dengan perasaan lebih tenang karena sudah 65% selesai kemarin."
    },
    {
      date: "2026-07-17",
      sleepHours: 7.0,
      mealFrequency: 3,
      stressLevel: 3.5,
      mood: "Calm",
      symptoms: ["Tidak ada keluhan"],
      voiceNoteTranscript: "Hari finishing, sangat lega. Tidur malam yang cukup nyenyak, dapat 7 jam penuh. Bangun dengan perasaan segar dan optimis."
    }
  ],
  symptomClusterAnalysis: {
    mostFrequentSymptom: "Asam lambung naik",
    frequencyCount: 4,
    clinicalTriggerContext: "Analisis dinamis data 7 hari menunjukkan pola klinis yang jelas: pasien mengalami acute stress episode yang dipicu oleh tekanan deadline pada hari ketiga (13 Juli), mengakibatkan penurunan dramatis sleep hours dari 7.2 jam menjadi 4.8 jam. Korelasi inverse sleep-stress terlihat jelas pada hari ketiga-keempat dengan sleep hours 4.8-5.0 jam diikuti stress level 7.5-8.2/10. Psychosomatic manifestation muncul sebagai gastroesophageal reflex (asam lambung naik) pada hari ketiga hingga keenam, berkorelasi kuat dengan periode high-stress. Migrain akut dan palpitasi terjadi pada puncak stress (hari keempat, stress 8.2/10, sleep 5.0 jam). Meal frequency menurun drastis dari 3 menjadi 2 kali sehari pada hari stress peak, menyebabkan fatigue dan pusing ringan. Mood progression menunjukkan aligned pattern: Calm (hari pertama-kedua) → Anxious-Stressed (hari ketiga-keempat) → gradual recovery (hari kelima-ketujuh). Pemulihan signifikan terjadi hari kelima dengan perbaikan meal pattern dan normalisasi sleep (6 jam), disertai penurunan stress ke 6.8. Hari ketujuh menunjukkan full recovery: sleep 7.0 jam, stress 3.5/10, mood Calm, dan zero symptoms. Clinical interpretation: akut stress-induced psychosomatic disorder dengan primary manifestation gastrointestinal hyperacidity dan secondary neurological symptoms (migraine, palpitations). Prognosis favorable dengan stress resolution dan lifestyle normalization."
  }
};

/**
 * Fungsi untuk trigger PDF generation
 * @param data - Health log data (opsional, gunakan sample data jika tidak disediakan)
 */
export async function handleGenerateMedicalReportPDF(data?: DailyLogData) {
  try {
    const reportData = data || SAMPLE_HEALTH_LOG_DATA;
    await generateMedicalReportPDF(reportData);
    console.log('PDF report generated successfully');
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw error;
  }
}

// Export untuk digunakan di komponen React Native
export { generateMedicalReportPDF, type DailyLogData };
