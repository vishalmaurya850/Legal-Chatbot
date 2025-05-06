const express = require("express")
const cors = require("cors")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const { createClient } = require("@supabase/supabase-js")
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf")
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter")
const { MistralAIEmbeddings } = require("@langchain/mistralai")
const dotenv = require("dotenv")

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + "-" + file.originalname)
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("Only PDF files are allowed"), false)
    }
  },
})

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize OpenAI embeddings
const embeddings = new MistralAIEmbeddings({
apiKey:process.env.MISTRAL_API_KEY,
model: "mistral-embed",
})

// Route for uploading and processing PDF
app.post("/api/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const { userId, documentName } = req.body

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" })
    }

    const filePath = req.file.path
    const fileName = req.file.originalname
    const fileSize = req.file.size
    const fileType = req.file.mimetype

    // Save document metadata to Supabase
    const { data: documentData, error: documentError } = await supabase
      .from("user_documents")
      .insert({
        user_id: userId,
        file_name: documentName || fileName,
        file_type: fileType,
        file_size: fileSize,
        file_path: filePath,
        processed: false,
      })
      .select()
      .single()

    if (documentError) {
      console.error("Error saving document metadata:", documentError)
      return res.status(500).json({ error: "Failed to save document metadata" })
    }

    // Process the PDF in the background
    processPdf(filePath, documentData.id)

    return res.status(200).json({
      message: "Document uploaded successfully and processing started",
      document: documentData,
    })
  } catch (error) {
    console.error("Error in upload-pdf endpoint:", error)
    return res.status(500).json({ error: error.message })
  }
})

// Function to process PDF and generate embeddings
async function processPdf(filePath, documentId) {
  try {
    console.log(`Processing PDF: ${filePath} for document ID: ${documentId}`)

    // Load PDF
    const loader = new PDFLoader(filePath)
    const docs = await loader.load()

    console.log(`Loaded ${docs.length} pages from PDF`)

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const chunks = await textSplitter.splitDocuments(docs)
    console.log(`Split into ${chunks.length} chunks`)

    // Process in batches to avoid rate limits
    const batchSize = 5
    let processedCount = 0

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)

      // Generate embeddings for the batch
      const embeddingPromises = batch.map((chunk) => embeddings.embedQuery(chunk.pageContent))
      const embeddingResults = await Promise.all(embeddingPromises)

      // Prepare data for insertion
      const dataToInsert = batch.map((chunk, index) => ({
        document_id: documentId,
        content: chunk.pageContent,
        embedding: embeddingResults[index],
        metadata: JSON.stringify(chunk.metadata),
      }))

      // Store in Supabase
      const { error } = await supabase.from("document_embeddings").insert(dataToInsert)

      if (error) {
        console.error("Error storing embeddings:", error)
      }

      processedCount += batch.length
      console.log(`Processed ${processedCount}/${chunks.length} chunks`)
    }

    // Update document as processed
    await supabase.from("user_documents").update({ processed: true }).eq("id", documentId)

    console.log(`Document ${documentId} processing complete!`)
  } catch (error) {
    console.error("Error processing PDF:", error)

    // Update document as failed
    await supabase
      .from("user_documents")
      .update({
        processed: true,
        metadata: JSON.stringify({ error: error.message }),
      })
      .eq("id", documentId)
  } finally {
    // Optionally clean up the file
    // fs.unlinkSync(filePath);
  }
}

// Route for processing the Indian Constitution PDF
app.post("/api/process-constitution", async (req, res) => {
  try {
    const { filePath } = req.body

    if (!filePath) {
      return res.status(400).json({ error: "Missing filePath parameter" })
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" })
    }

    // Load PDF
    console.log(`Loading PDF from ${filePath}...`)
    const loader = new PDFLoader(filePath)
    const docs = await loader.load()

    console.log(`Loaded ${docs.length} document(s)`)

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const chunks = await textSplitter.splitDocuments(docs)
    console.log(`Split into ${chunks.length} chunks`)

    // Process in batches to avoid rate limits
    const batchSize = 5
    let processedCount = 0

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

      processedCount += batch.length
      console.log(`Processed ${processedCount}/${chunks.length} chunks`)
    }

    return res.json({
      success: true,
      message: "Processing complete!",
      processedChunks: chunks.length,
    })
  } catch (error) {
    console.error("Error processing constitution:", error)
    return res.status(500).json({ error: error.message })
  }
})

// Route for generating embeddings
app.post("/api/generate-embedding", async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" })
    }

    // Generate embedding
    const embedding = await embeddings.embedQuery(text)

    return res.json({ data: embedding })
  } catch (error) {
    console.error("Error generating embedding:", error)
    return res.status(500).json({ error: error.message })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
