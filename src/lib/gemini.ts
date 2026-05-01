/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getWordDefinition(word: string): Promise<WordDefinition> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Please provide the definition, phonetic, example sentence, and a mnemonic for the word: "${word}". Output in the specified JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          meaning: { type: Type.STRING, description: "Chinese meaning of the word" },
          example: { type: Type.STRING, description: "An English example sentence with Chinese translation" },
          mnemonic: { type: Type.STRING, description: "A simple mnemonic device to help remember the word" }
        },
        required: ["word", "meaning", "example"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim()) as WordDefinition;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Could not fetch word definition");
  }
}
