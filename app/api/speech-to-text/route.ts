import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { transcribeAudio, calculateAudioDuration, detectAudioFormat } from "@/lib/speech-to-text";
import { setTimeout } from "timers/promises";

export async function POST(request: Request) {
  let formData: FormData | null = null;
  let audioFile: File | null = null;
  let sourceDevice: string | undefined;
  let userId: string | undefined;

  try {
    const supabase = await createServerSupabaseClient();
    formData = null; // Ensure formData is reset in case of re-entry
    audioFile = null; // Ensure audioFile is reset in case of re-entry

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data once
    formData = await request.formData();
    audioFile = formData.get("audio") as File;
    sourceDevice = formData.get("deviceInfo") as string | undefined;
    userId = formData.get("userId") as string;

    if (!audioFile || !userId) {
      return NextResponse.json({ error: "Missing audio file or userId" }, { status: 400 });
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 });
    }

    // Validate file size (5MB limit)
    if (audioFile.size > 5242880) {
      return NextResponse.json({ error: "Audio file exceeds 5MB limit" }, { status: 400 });
    }

    // Check if user exists in public.users, create if missing
    let { data: userExists, error: userCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (userCheckError || !userExists) {
      console.warn("User not found in public.users, creating record:", user.id, userCheckError);
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email || `Unknown User ${user.id}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Failed to create user record:", insertError);
        throw new Error("Failed to register user in system");
      }

      // Verify the user was created
      const { data: newUser, error: newUserError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (newUserError || !newUser) {
        console.error("User creation verification failed:", newUserError);
        throw new Error("User registration verification failed");
      }
    }

    // Convert the file to a buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect the audio format
    const mimeType = audioFile.type || detectAudioFormat(buffer);
    const audioFormat = mimeType.split("/")[1] || "unknown";

    // Calculate the audio duration
    const duration = calculateAudioDuration(buffer, mimeType);

    // Generate unique audio file path
    const audioFilePath = `audio/${user.id}/${Date.now()}-${audioFile.name}`;

    // Upload audio to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(audioFilePath, buffer, { 
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    console.log(`Processing audio: ${audioFile.size} bytes, type: ${mimeType}, duration: ${duration}s, path: ${audioFilePath}`);

    // Transcribe the audio with retry logic
    let transcriptionResult;
    const retries = 3;
    const delayMs = 5000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        transcriptionResult = await transcribeAudio(buffer, mimeType, "en-US");
        break;
      } catch (error: any) {
        if (attempt === retries || !error.message.includes("PERMISSION_DENIED")) {
          throw error;
        }
        console.log(`Retry ${attempt}/${retries} after ${delayMs}ms...`);
        await setTimeout(delayMs);
      }
    }

    const { transcription, confidence } = transcriptionResult;

    // Log the transcription to the database
    const { data: transcriptionData, error: transcriptionError } = await supabase
      .from("speech_transcriptions")
      .insert({
        user_id: user.id,
        audio_file_path: audioFilePath,
        transcription,
        language_code: "en-US",
        duration_seconds: duration,
        confidence,
        source_device: sourceDevice || "unknown",
        audio_format: audioFormat,
        is_processed: true,
        error_message: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (transcriptionError) {
      console.error("Error logging transcription:", transcriptionError);
      throw new Error(`Failed to log transcription: ${transcriptionError.message}`);
    }

    return NextResponse.json({
      transcription,
      confidence,
      duration,
      audioFilePath,
    });
  } catch (error: any) {
    console.error("Error in speech-to-text API:", error);

    // Log error to speech_transcriptions table
    const supabase = await createServerSupabaseClient();

    if (userId && audioFile) {
      try {
        // Check if user exists, create if missing
        let { data: userExists, error: userCheckError } = await supabase
          .from("users")
          .select("id")
          .eq("id", userId)
          .single();

        if (userCheckError || !userExists) {
          console.warn("User not found for error logging, creating record:", userId, userCheckError);
          const { error: insertError } = await supabase
            .from("users")
            .insert({
              id: userId,
              full_name: "Unknown User",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error("Failed to create user record for error logging:", insertError);
            throw new Error("Failed to register user for error logging");
          }

          // Verify creation
          const { data: newUser, error: newUserError } = await supabase
            .from("users")
            .select("id")
            .eq("id", userId)
            .single();

          if (newUserError || !newUser) {
            console.error("User creation verification failed for error logging:", newUserError);
            throw new Error("User registration verification failed for error logging");
          }
        }

        const buffer = Buffer.from(await audioFile.arrayBuffer());
        const mimeType = audioFile.type || detectAudioFormat(buffer);
        const audioFormat = mimeType.split("/")[1] || "unknown";
        const duration = calculateAudioDuration(buffer, mimeType);
        const audioFilePath = `audio/${userId}/${Date.now()}-${audioFile.name}`;

        const { error: logError } = await supabase
          .from("speech_transcriptions")
          .insert({
            user_id: userId,
            audio_file_path: audioFilePath,
            transcription: "",
            language_code: "en-US",
            duration_seconds: duration,
            confidence: 0,
            source_device: sourceDevice || "unknown",
            audio_format: audioFormat,
            is_processed: false,
            error_message: error.message || "Failed to process audio",
            created_at: new Date().toISOString(),
          });

        if (logError) {
          console.error("Error logging transcription error:", logError);
        }
      } catch (logError) {
        console.error("Failed to log error to speech_transcriptions:", logError);
      }
    }

    return NextResponse.json({ error: error.message || "Failed to process audio" }, { status: 500 });
  }
}