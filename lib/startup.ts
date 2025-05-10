import { processMultiplePDFs } from "@/scripts/process-constitution"

export async function runStartupTasks(): Promise<void> {
  console.log("Running startup tasks...")

  try {
    // Process multiple PDFs
    await processMultiplePDFs()
  } catch (error) {
    console.error("Error running startup tasks:", error)
  }
}