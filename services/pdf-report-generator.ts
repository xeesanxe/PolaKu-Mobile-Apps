import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Hubungkan dengan tipe data yang dihasilkan oleh AI Agent Gemini kamu
export interface DailyLogData {
  patientId: string;
  period: string;
  averages: {
    sleepHours: number;
    mealFrequency: number;
    stressLevel: number;
    dominantMood: string;
  };
  dailyLogs: Array<{
    date: string;
    sleepHours: number;
    mealFrequency: number;
    stressLevel: number;
    mood: string;
    symptoms: string[];
    voiceNoteTranscript: string;
  }>;
  symptomClusterAnalysis: {
    mostFrequentSymptom: string;
    frequencyCount: number;
    clinicalTriggerContext: string;
  };
}

export async function generateMedicalReportPDF(data: DailyLogData): Promise<void> {
  // 1. Generate baris tabel data mentah secara dinamis
  const tableRowsHtml = data.dailyLogs
    .map(
      (log) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: center;">${log.date}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: center;">${log.sleepHours}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: center;">${log.mealFrequency}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: center; font-weight: bold; color: ${log.stressLevel >= 7 ? '#DC2626' : '#1F2937'}">${log.stressLevel}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: center;">${log.mood}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px;">${log.symptoms.join(', ')}</td>
    </tr>
  `
    )
    .join('');

  // 2. Kalkulasi koordinat SVG Polyline untuk Tren Chart (Sleep vs Stress)
  // Memetakan nilai data ke koordinat SVG (Width: 500, Height: 150)
  const widthStep = 500 / (data.dailyLogs.length - 1);
  
  const sleepPoints = data.dailyLogs
    .map((log, index) => `${index * widthStep},${150 - (log.sleepHours * 12)}`) // Skala tidur max 12 jam
    .join(' ');

  const stressPoints = data.dailyLogs
    .map((log, index) => `${index * widthStep},${150 - (log.stressLevel * 15)}`) // Skala stres max 10
    .join(' ');

  // 3. Template HTML Utama Laporan Klinis
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Medical Health Report</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; margin: 0; padding: 40px; font-size: 13px; line-height: 1.5; }
        .header { border-bottom: 2px solid #1E3A8A; padding-bottom: 10px; margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: bold; color: #1E3A8A; text-transform: uppercase; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #BFDBFE; padding-bottom: 4px; }
        .summary-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .data-table th { background-color: #F3F4F6; padding: 8px; font-weight: bold; text-align: center; border-bottom: 2px solid #D1D5DB; }
        .alert-box { background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 10px; margin-bottom: 15px; font-style: italic; }
        .chart-container { text-align: center; margin: 20px 0; background: #FAF5FF; padding: 15px; border-radius: 8px; border: 1px solid #E9D5FF; }
      </style>
    </head>
    <body>

      <!-- HEADER & PATIENT INFO -->
      <div class="header">
        <table style="width: 100%;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 20px; color: #1E3A8A;">LAPORAN TREN KESEHATAN HARIAN</h1>
              <p style="margin: 4px 0 0 0; color: #6B7280;">Periode Pemantauan: ${data.period}</p>
            </td>
            <td style="text-align: right; vertical-align: bottom;">
              <p style="margin: 0; font-weight: bold;">ID Pasien: ${data.patientId}</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- A. CLINICAL SUMMARY -->
      <div class="section-title">A. Ringkasan Eksekutif & Skor Klinis</div>
      <table class="summary-table" style="background-color: #F9FAFB; border: 1px solid #E5E7EB;">
        <tr>
          <td style="padding: 12px; border-right: 1px solid #E5E7EB; text-align: center;">
            <div style="font-size: 11px; color: #6B7280;">Rerata Tidur</div>
            <div style="font-size: 18px; font-weight: bold; color: #1E3A8A;">${data.averages.sleepHours.toFixed(1)} Jam</div>
          </td>
          <td style="padding: 12px; border-right: 1px solid #E5E7EB; text-align: center;">
            <div style="font-size: 11px; color: #6B7280;">Frekuensi Makan</div>
            <div style="font-size: 18px; font-weight: bold; color: #1E3A8A;">${data.averages.mealFrequency.toFixed(1)}x / Hari</div>
          </td>
          <td style="padding: 12px; border-right: 1px solid #E5E7EB; text-align: center;">
            <div style="font-size: 11px; color: #6B7280;">Rerata Tingkat Stres</div>
            <div style="font-size: 18px; font-weight: bold; color: #DC2626;">${data.averages.stressLevel.toFixed(1)} / 10</div>
          </td>
          <td style="padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: #6B7280;">Dominasi Mood</div>
            <div style="font-size: 16px; font-weight: bold; color: #7C3AED;">${data.averages.dominantMood}</div>
          </td>
        </tr>
      </table>

      <!-- B. VISUALIZATION CHART (SVG Embedded) -->
      <div class="section-title">B. Grafik Tren Fluktuasi (Tidur vs Tingkat Stres)</div>
      <div class="chart-container">
        <svg viewBox="0 0 520 180" style="width: 100%; height: auto;">
          <!-- Grid Lines -->
          <line x1="10" y1="150" x2="510" y2="150" stroke="#E5E7EB" stroke-width="1" />
          <line x1="10" y1="75" x2="510" y2="75" stroke="#E5E7EB" stroke-dasharray="4" />
          <line x1="10" y1="10" x2="510" y2="10" stroke="#E5E7EB" stroke-width="1" />
          
          <!-- Line 1: Sleep Hours (Biru) -->
          <polyline fill="none" stroke="#2563EB" stroke-width="3" points="${sleepPoints}" />
          <!-- Line 2: Stress Level (Merah) -->
          <polyline fill="none" stroke="#DC2626" stroke-width="3" stroke-dasharray="2" points="${stressPoints}" />
        </svg>
        <div style="font-size: 11px; color: #4B5563; margin-top: 5px;">
          <span style="color: #2563EB; font-weight: bold;">━</span> Durasi Tidur (Jam) &nbsp;&nbsp;&nbsp;&nbsp;
          <span style="color: #DC2626; font-weight: bold;">- -</span> Tingkat Stres (Skala 1-10)
        </div>
      </div>

      <!-- C. STRUCTURED RAW DATA -->
      <div class="section-title">C. Log Data Mentah Terstruktur</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 15%;">Tanggal</th>
            <th style="width: 12%;">Tidur (Jam)</th>
            <th style="width: 12%;">Makan (Sesi)</th>
            <th style="width: 12%;">Stres (1-10)</th>
            <th style="width: 15%;">Mood</th>
            <th style="width: 34%;">Gejala Fisik Terdeteksi</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <!-- D. SYMPTOM CLUSTER ANALYSIS -->
      <div class="section-title">D. Analisis Klaster Gejala (Symptom Cluster)</div>
      <div class="alert-box">
        <strong>Temuan Klinis Dinamis:</strong> Keluhan klinis utama terpusat pada <strong>${data.symptomClusterAnalysis.mostFrequentSymptom}</strong> dengan frekuensi kemunculan sebanyak ${data.symptomClusterAnalysis.frequencyCount} kali dalam siklus 7 hari. ${data.symptomClusterAnalysis.clinicalTriggerContext}
      </div>

      <!-- E. MEDICAL SIGN-OFF -->
      <div class="section-title" style="margin-top: 40px;">E. Kolom Rekomendasi Medis (Untuk Diisi Dokter)</div>
      <div style="margin-top: 15px;">
        <p style="border-bottom: 1px solid #D1D5DB; padding-bottom: 20px; color: #9CA3AF;">Catatan Klinis / Tindak Lanjut Terapi:</p>
        <p style="border-bottom: 1px solid #D1D5DB; padding-bottom: 20px; color: #9CA3AF; margin-top: 25px;">Rekomendasi Farmakoterapi / Rujukan:</p>
      </div>
      
      <table style="width: 100%; margin-top: 50px;">
        <tr>
          <td style="width: 60%;"></td>
          <td style="text-align: center; border-top: 1px solid #1F2937; padding-top: 5px; width: 40%;">
            Tanda Tangan & Nama Terang Dokter
          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  // 4. Eksekusi Print HTML ke PDF File lokal, lalu buka native share sheet
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    console.log('PDF berhasil dibuat di lokasi:', uri);
    
    // Buka dialog share/save file bawaan HP Android/iOS
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Simpan Laporan Medis' });
    }
  } catch (error) {
    console.error('Gagal mencetak laporan PDF:', error);
    throw error;
  }
}
