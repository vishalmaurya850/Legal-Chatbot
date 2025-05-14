import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/rag/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = await createServerSupabaseClient();
    const { chatId, message, userId } = await request.json();

    if (!chatId || !message || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const embedding = await generateEmbedding(message);

    const { data: matchingDocuments, error: matchError } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
      filter_document_id: null,
    });

    if (matchError) {
      console.error("Error matching documents:", matchError);
      return NextResponse.json({ error: "Failed to match documents" }, { status: 500 });
    }

    let context = "";
    if (matchingDocuments && matchingDocuments.length > 0) {
      context = matchingDocuments.map((doc: { content: string }) => doc.content).join("\n\n");
    }

    const prompt = context
      ? `You are VIDHI 7, a legal assistant specializing in Indian law. Use the following context to answer the user's question. If the context doesn't contain relevant information, say you don't have enough information and suggest consulting a lawyer.

Context:
${context}

User question: ${message}

Answer in a helpful, professional manner. Format your response using markdown for better readability. Include citations where appropriate.`
      : `You are VIDHI 7, a legal assistant specializing in Indian law. The user has asked a question that we don't have specific context for in our database. Please provide a general answer based on your knowledge of Indian law. If the question requires specific legal advice, make sure to recommend consulting with a qualified lawyer.

User question: ${message}

Answer in a helpful, professional manner. Format your response using markdown for better readability. Include a disclaimer that this is general information and not specific legal advice.`;

    let botResponse = "";
    try {
      const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro-002" });
      const result = await model.generateContent(prompt);
      botResponse = result.response.text();
    } catch (genAIError) {
      console.error("Error generating content with Gemini:", genAIError);
      return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("messages").insert({
      chat_session_id: chatId,
      user_id: userId,
      content: botResponse,
      is_bot: true,
    });

    if (insertError) {
      console.error("Error inserting bot response:", insertError);
      return NextResponse.json({ error: "Failed to save bot response" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: botResponse });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}