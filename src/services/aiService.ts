import { GoogleGenAI, Type } from "@google/genai";
import { Anime } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours for AI recommendations

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = localStorage.getItem(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }
  const data = await fetcher();
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  return data;
}

export interface AIRecommendation {
  title: string;
  reason: string;
}

export async function getAIRecommendations(anime: Anime, excludeTitles: string[] = []): Promise<AIRecommendation[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return [];
  }

  return fetchWithCache(`ai_rec_${anime.mal_id}`, async () => {
    const excludeText = excludeTitles.length > 0 ? `\nDo not recommend any of these titles: ${excludeTitles.join(", ")}.` : "";
  
    const prompt = `Based on the anime "${anime.title_english || anime.title}", which has the following genres: ${anime.genres?.map(g => g.name).join(", ")} and themes: ${anime.themes?.map(t => t.name).join(", ")}. 
    Synopsis: ${anime.synopsis}
    ${excludeText}
    
    Please recommend 6 similar anime titles that a fan of this show would enjoy. For each recommendation, provide a brief reason why it's a good match.
    Return the results as a JSON array of objects with "title" and "reason" fields.`;
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["title", "reason"]
            }
          }
        }
      });
  
      const text = response.text;
      if (!text) return [];
      return JSON.parse(text);
    } catch (error) {
      console.error("AI Recommendation Error:", error);
      return [];
    }
  });
}
