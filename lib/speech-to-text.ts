import { SpeechClient } from "@google-cloud/speech"

// Initialize the Google Cloud clients
let speechClient: SpeechClient

try {
  // Initialize the Speech client with credentials from environment variables
  speechClient = new SpeechClient()
} catch (error) {
  console.error("Error initializing Google Cloud Speech client:", error)
}

interface TranscriptionResult {
  transcription: string
  confidence: number
}

/**
 * Transcribes audio using Google Cloud Speech-to-Text API
 * @param audioBuffer The audio buffer to transcribe
 * @param mimeType The MIME type of the audio (e.g., 'audio/webm', 'audio/wav')
 * @param languageCode The language code (default: 'en-US')
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/webm",
  languageCode = "en-US",
): Promise<TranscriptionResult> {
  try {
    // For short audio (< 1 minute), we can use the synchronous recognize method
    const [response] = await speechClient.recognize({
      audio: {
        content: audioBuffer.toString("base64"),
      },
      config: {
        encoding: mimeType.includes("webm") ? "WEBM_OPUS" : "LINEAR16",
        sampleRateHertz: 48000,
        languageCode,
        model: "default",
        useEnhanced: true,
        enableAutomaticPunctuation: true,
      },
    })

    const transcription =
      response.results
        ?.map((result) => result.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ") || ""

    const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0

    return {
      transcription,
      confidence,
    }
  } catch (error) {
    console.error("Error transcribing audio:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to transcribe audio: ${error.message}`)
    } else {
      throw new Error("Failed to transcribe audio: Unknown error")
    }
  }
}

/**
 * Calculates the duration of an audio file in seconds
 * This is an approximation based on the file size and encoding
 */
export function calculateAudioDuration(audioBuffer: Buffer, mimeType = "audio/webm"): number {
  // For WebM with Opus, approximate 32 kbps
  // For WAV, approximate 16-bit PCM at 48kHz stereo
  const bytesPerSecond = mimeType.includes("webm") ? 4000 : 192000
  return audioBuffer.length / bytesPerSecond
}

/**
 * Detects the audio format from the buffer
 */
export function detectAudioFormat(buffer: Buffer): string {
  // Check for WAV header (RIFF)
  if (buffer.length >= 4 && buffer.slice(0, 4).toString() === "RIFF") {
    return "audio/wav"
  }

  // Check for WebM header (starts with 0x1A 0x45 0xDF 0xA3)
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "audio/webm"
  }

  // Default to WebM
  return "audio/webm"
}
