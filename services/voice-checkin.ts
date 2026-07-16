import { httpsCallable } from 'firebase/functions';
import * as FileSystem from 'expo-file-system/legacy';

import { functions } from '@/services/firebase';

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
  const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const voiceExtractFn = httpsCallable<{ audioBase64: string }, VoiceExtractResult>(
    functions,
    'voiceExtract',
  );

  const result = await voiceExtractFn({ audioBase64 });
  return result.data;
}