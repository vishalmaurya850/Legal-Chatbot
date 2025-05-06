import { createClient } from "@supabase/supabase-js"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { MistralAIEmbeddings } from "@langchain/mistralai"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const mistralApiKey = process.env.MISTRAL_API_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials")
  process.exit(1)
}

if (!mistralApiKey) {
  console.error("Missing OpenAI API key")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function processConstitution() {
  try {
    // Check if constitution embeddings already exist
    const { count } = await supabase.from("constitution_embeddings").select("*", { count: "exact", head: true })

    if (count && count > 0) {
      console.log(`Constitution embeddings already exist (${count} entries). Skipping processing.`)
      return
    }

    const pdfPath = path.join(process.cwd(), "lib", "Indian_Constitution.pdf")

    // Ensure the PDF file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file not found at ${pdfPath}`)
      return
    }

    console.log(`Loading PDF from ${pdfPath}...`)
    const loader = new PDFLoader(pdfPath)
    const docs = await loader.load()

    console.log(`Loaded ${docs.length} document(s)`)

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const chunks = await textSplitter.splitDocuments(docs)
    console.log(`Split into ${chunks.length} chunks`)

    // Create embeddings
    const embeddings = new MistralAIEmbeddings({
      apiKey: mistralApiKey,
      model: "mistral-embed",
    })

    console.log("Generating embeddings and storing in Supabase...")

    // Process in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      // Generate embeddings for the batch
      const embeddingPromises = batch.map((chunk) => embeddings.embedQuery(chunk.pageContent))
      const embeddingResults = await Promise.all(embeddingPromises)

      // Prepare data for insertion
      const dataToInsert = batch.map((chunk, index) => ({
        content: chunk.pageContent,
        embedding: embeddingResults[index],
        metadata: JSON.stringify(chunk.metadata),
      }))

      // Store in Supabase
      const { error } = await supabase.from("constitution_embeddings").insert(dataToInsert)

      if (error) {
        console.error("Error storing embeddings:", error)
      }

      console.log(`Processed ${i + batch.length}/${chunks.length} chunks`)
    }

    console.log("Processing complete!")
  } catch (error) {
    console.error("Error processing constitution:", error)
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  processConstitution().catch(console.error)
}

export { processConstitution }