import { processConstitution } from "@/scripts/process-constitution"

export async function runStartupTasks() {
  console.log("Running startup tasks...")

  try {
    // Process the Indian Constitution PDF
    await processConstitution()
  } catch (error) {
    console.error("Error running startup tasks:", error)
  }
}
