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
  console.error("Missing Mistral API key")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// List of PDF paths using path.join
const pdfPaths: string[] = [
  path.join(process.cwd(), "lib", "ChildrenLaw.pdf"),
  path.join(process.cwd(), "lib", "EnsuringEffectiveLegalServices.pdf"),
  path.join(process.cwd(), "lib", "GreenLegalOperations.pdf"),
  path.join(process.cwd(), "lib", "Harrasment.pdf"),
  path.join(process.cwd(), "lib", "Legaldata.pdf"),
  path.join(process.cwd(), "lib", "LegalServicesLawyers.pdf"),
  path.join(process.cwd(), "lib", "LegalServicesLawyers1.pdf"),
  path.join(process.cwd(), "lib", "LegalServicesLawyers3.pdf"),
  path.join(process.cwd(), "lib", "LegalServicesonacts.pdf"),
  path.join(process.cwd(), "lib", "Nyayadeep.pdf"),
  path.join(process.cwd(), "lib", "ParaLegalVolunteers.pdf"),
  path.join(process.cwd(), "lib", "WomenLaws.pdf"),
  path.join(process.cwd(), "lib", "Indian_Constitution.pdf")
]
// const { count } = await supabase.from("constitution_embeddings").select("*", { count: "exact", head: true })
async function processConstitution(pdfPath: string): Promise<void> {
  try {
    // Extract filename for logging and metadata
    const fileName = path.basename(pdfPath, ".pdf")

    // Check if embeddings already exist for this PDF
    const { count } = await supabase
      .from("constitution_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("metadata->>source", pdfPath)

    if (count && count > 0) {
      console.log(`Embeddings for ${fileName} already exist (${count} entries). Skipping processing.`)
      return
    }

    // Ensure the PDF file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF file not found at ${pdfPath}`)
      return
    }

    console.log(`Loading PDF from ${pdfPath}...`)
    const loader = new PDFLoader(pdfPath)
    const docs = await loader.load()

    console.log(`Loaded ${docs.length} document(s) from ${fileName}`)

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const chunks = await textSplitter.splitDocuments(docs)
    console.log(`Split ${fileName} into ${chunks.length} chunks`)

    // Create embeddings
    const embeddings = new MistralAIEmbeddings({
      apiKey: mistralApiKey,
      model: "mistral-embed",
    })

    console.log(`Generating embeddings for ${fileName} and storing in Supabase...`)

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
        metadata: JSON.stringify({
          ...chunk.metadata,
          source: pdfPath,
          fileName: fileName
        }),
      }))

      // Store in Supabase
      const { error } = await supabase.from("constitution_embeddings").insert(dataToInsert)

      if (error) {
        console.error(`Error storing embeddings for ${fileName}:`, error)
      }

      console.log(`Processed ${i + batch.length}/${chunks.length} chunks for ${fileName}`)
    }

    console.log(`Processing complete for ${fileName}!`)
  } catch (error) {
    console.error(`Error processing ${pdfPath}:`, error)
  }
}

async function processMultiplePDFs(): Promise<void> {
  for (const pdfPath of pdfPaths) {
    await processConstitution(pdfPath)
  }
  console.log("All PDFs processed!")
}

// Run the function if this script is executed directly
if (require.main === module) {
  processMultiplePDFs().catch(console.error)
}

export { processConstitution, processMultiplePDFs }