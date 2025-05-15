import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { RunnableSequence } from "@langchain/core/runnables"
import type { Database } from "@/types/supabase"
import { MistralAIEmbeddings } from "@langchain/mistralai"

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
  model: "models/gemini-2.0-flash-thinking-exp-1219",
  maxOutputTokens: 1024,
  temperature: 0.2,
  safetySettings,
})

// Function to generate embedding using Mistral AI
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embeddings = new MistralAIEmbeddings({
      apiKey: process.env.MISTRAL_API_KEY!,
      model: "mistral-embed",
    })

    const result = await embeddings.embedQuery(text)
    return result
  } catch (error) {
    console.error("Error generating embedding:", error)

    // Fallback to server API if Mistral fails
    try {
      const response = await fetch(
        `${process.env.EMBEDDING_API_URL || "http://localhost:3001"}/api/generate-embedding`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to generate embedding: ${response.statusText}`)
      }

      const { data } = await response.json()
      return data
    } catch (fallbackError) {
      console.error("Error in fallback embedding generation:", fallbackError)
      throw error // Throw the original error
    }
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

    if (!documents || documents.length === 0) {
      console.log("No relevant documents found in vector store, falling back to web search")
      return await searchWeb(query)
    }

    // Combine the retrieved documents into context
    return documents
      .map((doc: any) => {
        const source = doc.document_id ? `[Document: ${doc.document_id}]` : "[Indian Constitution]"
        const metadata = doc.metadata ? JSON.parse(doc.metadata) : {}
        const fileName = metadata.fileName || ""
        const pageInfo = metadata.loc?.pageNumber ? `Page ${metadata.loc.pageNumber}` : ""

        return `${source} ${fileName} ${pageInfo}\n${doc.content}\n`
      })
      .join("\n\n")
  } catch (error) {
    console.error("Error getting relevant context:", error)
    // Fallback to web search if vector search fails
    return await searchWeb(query)
  }
}

// Function to search the web for information using Google Search API
export async function searchWeb(query: string): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

    if (!apiKey || !searchEngineId) {
      console.error("Google Search API key or Search Engine ID not configured")
      return "No relevant information found in our database, and web search is not configured."
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Google search failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return "No relevant information found from web search."
    }

    // Format the search results into a context string
    const searchResults = data.items
      .slice(0, 5)
      .map((item: any) => {
        return `[${item.title}] (${item.link})\n${item.snippet}\n`
      })
      .join("\n\n")

    return `Web search results for "${query}":\n\n${searchResults}`
  } catch (error) {
    console.error("Error searching web:", error)
    return "I encountered an error while searching for information online. Please try a different question or approach."
  }
}

// Function to generate response using Gemini with RAG
export async function generateGeminiResponse(
  query: string,
  context: string,
  chatHistory: { role: "user" | "assistant"; content: string }[],
) {
  try {
    // Check if context is from web search
    const isWebSearch = context.startsWith("Web search results for")

    // Create a prompt template
    const promptTemplate = PromptTemplate.fromTemplate(`
      You are VIDHI 7, a legal assistant specialized in the Indian Constitution and Indian law.
      ${
        isWebSearch
          ? "The following information was retrieved from a web search. Use it to answer the user's question."
          : "Use the following context to answer the user's question. If you don't know the answer based on the context, say so politely."
      }
      Don't make up information or provide false information.
      Don't provide any information that is not related to the Indian Constitution.
      You should ask a proper legitimate question if you don't understand the user's question.
      You can ask Location, Date, Time, and other relevant information if needed.
      You should ask for objects or things if user is harmed or in danger.

      IMPORTANT GUIDELINES:
      1. Always provide accurate and relevant information based on the Indian Constitution.
      2. Do not generate, promote or engage with harmful, illegal, or unethical content.
      3. Do not discuss sensitive political topics in a biased manner.
      4. Do not generate sexually explicit, offensive, or inappropriate content.
      5. Maintain a professional, helpful, and educational tone.
      6. If you're unsure about an answer, acknowledge your limitations.
      7. Cite specific articles or sections of the Constitution when possible.
      8. When citing from the context, include the source information in your answer.
      9. If the user asks for legal advice, clarify that you are not a licensed attorney.
      10. If the user asks for sensitive information, politely decline to provide it.
      11. If the user asks for personal information, politely decline to provide it.
      12. If the user asks for illegal or harmful content, politely decline to provide it.
      13. If the user asks for sensitive political topics, politely decline to provide it.
      14. If the user asks for sensitive or explicit content, politely decline to provide it.
      15. If user needs help, help them to the best of your ability and provide relevant information and resources.
      16. Use online resources to provide accurate and relevant information.
      17. Format your response using markdown for better readability.
      
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