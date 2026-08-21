// Vérification ponctuelle (chantier 0) : appel Gemini DIRECT, sans repli
// heuristique, pour confirmer que l'identifiant de modèle fonctionne réellement.
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("ÉCHEC : GEMINI_API_KEY absente.");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const reponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents:
        "Réponds uniquement par : OK — modèle opérationnel. Ne rien ajouter d'autre."
    });
    console.log("MODÈLE gemini-3.5-flash → RÉPONSE RÉELLE :");
    console.log(reponse.text);
  } catch (e) {
    console.error("ÉCHEC appel direct :", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
