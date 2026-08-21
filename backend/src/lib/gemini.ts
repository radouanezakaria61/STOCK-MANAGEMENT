import { GoogleGenAI } from "@google/genai";

// Client Gemini initialisé paresseusement pour ne pas crasher le serveur
// si la clé est absente au démarrage (repli sur moteur heuristique local).
let aiClient: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "") {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      console.log("Gemini AI Client initialized successfully.");
    } else {
      console.warn(
        "GEMINI_API_KEY is not defined. Falling back to rule-based procurement advisory."
      );
    }
  }
  return aiClient;
}
