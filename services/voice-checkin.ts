import { httpsCallable, getFunctions } from 'firebase/functions';
import * as FileSystem from 'expo-file-system/legacy';

// Impor instansiasi utama app Firebase kamu untuk menginisialisasi functions secara aman
import { app } from '@/services/firebase'; 

export type ExtractedFields = {
  sleepHours?: number;
  symptoms?: string[];
  mealFrequency?: number;
  stressLevel?: number;
  mood?: string;
};

export type VoiceExtractResult = {
  transcript: string;
  extractedFields: ExtractedFields;
  confidence: 'high' | 'medium' | 'low';
  missingFields: string[];
};

export async function extractVoiceCheckIn(audioUri: string): Promise<VoiceExtractResult> {
  try {
    // 1. Membaca file audio mentah dari cache lokal dan mengubahnya ke string Base64 menggunakan modul legacy
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 2. Inisialisasi functions dengan region yang tepat (us-central1)
    const firebaseFunctionsInstance = getFunctions(app, 'us-central1');

    // 3. Panggil HTTPS Callable dengan passing tipe generic yang tepat
    const voiceExtractFn = httpsCallable<{ audioBase64: string }, VoiceExtractResult>(
      firebaseFunctionsInstance,
      'voiceExtract'
    );

    const result = await voiceExtractFn({ audioBase64 });
    return result.data;
    
  } catch (error: any) {
    console.error("Error pada extractVoiceCheckIn:", error);
    throw new Error(error.message || "Gagal mengekstrak data suara.");
  }
}

export type SaveDailyLogInput = {
  date: string;
  sleepHours: number;
  symptoms: string[];
  mealFrequency: number;
  stressLevel: number;
  mood: string;
  inputMethod: 'voice' | 'choice';
};

export async function saveDailyLog(input: SaveDailyLogInput) {
  try {
    const firebaseFunctionsInstance = getFunctions(app, 'us-central1');
    const saveDailyLogFn = httpsCallable<SaveDailyLogInput, any>(firebaseFunctionsInstance, 'saveDailyLog');
    const result = await saveDailyLogFn(input);
    return result.data;
  } catch (error: any) {
    console.error("Error pada saveDailyLog:", error);
    throw new Error(error.message || "Gagal menyimpan log harian.");
  }
}