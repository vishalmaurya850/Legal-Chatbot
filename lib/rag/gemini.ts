import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { RunnableSequence } from "@langchain/core/runnables"
import type { Database } from "@/types/supabase"

// Initialize Supabase client for vector operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Configure safety settings
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
]

// Initialize Gemini model
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
  model: "models/gemini-1.5-pro",
  maxOutputTokens: 1024,
  temperature: 0.2,
  safetySettings,
})

// Function to generate embedding using the server API
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${process.env.EMBEDDING_API_URL || "http://localhost:3001"}/api/generate-embedding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate embedding: ${response.statusText}`)
    }

    const { data } = await response.json()
    return data
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw error
  }
}

// Function to query the vector store and get relevant context
export async function getRelevantContext(query: string, documentId?: string): Promise<string> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query)

    // Query the vector store for similar documents
    const { data: documents, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
      filter_document_id: documentId || null,
    })

    if (error) {
      console.error("Error querying vector store:", error)
      return ""
    }

    // Combine the retrieved documents into context
    return documents
      .map((doc: any) => {
        const source = doc.document_id ? `[Document: ${doc.document_id}]` : "[Indian Constitution]"
        const metadata = doc.metadata ? JSON.parse(doc.metadata) : {}
        const pageInfo = metadata.loc?.pageNumber ? `Page ${metadata.loc.pageNumber}` : ""

        return `${source} ${pageInfo}\n${doc.content}\n`
      })
      .join("\n\n")
  } catch (error) {
    console.error("Error getting relevant context:", error)
    return ""
  }
}

// Function to generate response using Gemini with RAG
export async function generateGeminiResponse(
  query: string,
  context: string,
  chatHistory: { role: "user" | "assistant"; content: string }[],
) {
  try {
    // Create a prompt template
    const promptTemplate = PromptTemplate.fromTemplate(`
      You are a legal assistant specialized in the Indian Constitution.
      Use the following context to answer the user's question.
      If you don't know the answer based on the context, say so politely.
      
      IMPORTANT GUIDELINES:
      1. Do not provide legal advice that could be construed as professional legal counsel.
      2. Do not generate, promote or engage with harmful, illegal, or unethical content.
      3. Do not discuss sensitive political topics in a biased manner.
      4. Do not generate sexually explicit, offensive, or inappropriate content.
      5. Maintain a professional, helpful, and educational tone.
      6. If you're unsure about an answer, acknowledge your limitations.
      7. Cite specific articles or sections of the Constitution when possible.
      8. When citing from the context, include the source information in your answer.
      
      Context:
      {context}
      
      Chat History:
      {chatHistory}
      
      User Question: {query}
    `)

    // Format chat history for the prompt
    const formattedChatHistory = chatHistory
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n")

    // Create a runnable sequence
    const chain = RunnableSequence.from([
      {
        context: () => context,
        chatHistory: () => formattedChatHistory,
        query: () => query,
      },
      promptTemplate,
      model,
      new StringOutputParser(),
    ])

    // Generate the response
    const response = await chain.invoke({})

    return { text: response, context }
  } catch (error) {
    console.error("Error generating response:", error)

    // Check if it's a safety error
    if (error instanceof Error && error.toString().includes("safety")) {
      return {
        text: "I apologize, but I cannot provide a response to this query as it may involve sensitive content. Please ensure your question is related to the Indian Constitution and is not requesting harmful, illegal, or inappropriate information.",
        context: "",
      }
    }

    return {
      text: "I apologize, but I encountered an error while processing your request. Please try again later.",
      context: "",
    }
  }
}

// Function to save feedback for model improvement
export async function saveFeedback(messageId: string, userId: string, rating: number, comment?: string) {
  try {
    const { error } = await supabase.from("feedback").insert({
      message_id: messageId,
      user_id: userId,
      rating,
      comment,
    })

    if (error) {
      console.error("Error saving feedback:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error saving feedback:", error)
    return false
  }
}