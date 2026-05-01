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

export async function extractWordsFromText(text: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract a list of English vocabulary words worth learning from the following text: "${text}". If it's a list, just return the list. If it's a sentence, extract the key nouns, verbs, adjectives that are likely for a learner. Return a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    const words = JSON.parse(response.text.trim());
    return Array.isArray(words) ? words : [];
  } catch (error) {
    console.error("Failed to extract words:", error);
    // Fallback: simple split and filter
    return text.split(/\s+/).map(w => w.replace(/[^a-zA-Z]/g, '')).filter(w => w.length > 2);
  }
}
