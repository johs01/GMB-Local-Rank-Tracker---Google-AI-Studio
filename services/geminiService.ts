import { GoogleGenAI, Type } from "@google/genai";
import { Business, GroundingSource, ScanResult } from '../types';

const getClient = () => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY is not configured. Please set it in your environment variables.");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

const parseGroundingChunks = (chunks: any[] | undefined): GroundingSource[] => {
    if (!chunks) return [];
    
    const sources: GroundingSource[] = [];
    chunks.forEach(chunk => {
        if (chunk.web) {
            sources.push({ uri: chunk.web.uri, title: chunk.web.title });
        } else if (chunk.maps) {
            sources.push({ uri: chunk.maps.uri, title: chunk.maps.title });
            if (chunk.maps.placeAnswerSources?.reviewSnippets) {
                chunk.maps.placeAnswerSources.reviewSnippets.forEach((snippet: any) => {
                     sources.push({ uri: snippet.uri, title: snippet.title });
                });
            }
        }
    });
    return sources;
};

async function parseBusinessList(text: string): Promise<Business[]> {
    const jsonString = text.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    if (!jsonString) return [];
    
    try {
        const result = JSON.parse(jsonString);
        
        if (Array.isArray(result)) {
            return result.filter(b => b.id && b.name && b.address && b.latitude && b.longitude) as Business[];
        } else if (typeof result === 'object' && result !== null) {
            const key = Object.keys(result)[0];
            if (key && Array.isArray(result[key])) {
                return result[key].filter((b: any) => b.id && b.name && b.address && b.latitude && b.longitude) as Business[];
            }
        }
    } catch (error) {
        console.error("Failed to parse JSON from Gemini response:", error);
        console.error("Original text:", text);
        return []; // Return empty array if parsing fails
    }
    return [];
}

export async function searchLocalBusinesses(
    query: string,
    location?: { latitude: number; longitude: number }
  ): Promise<Business[]> {
    try {
      const ai = getClient();
      const prompt = `Find local businesses that match the query "${query}". If the query includes a location, use that. Otherwise, use the provided coordinates as the search center.
      Respond with ONLY a JSON array of objects. Do not include any other text, explanations, or markdown formatting.
      Each object in the array should represent a business and have the following properties: "id" (the unique Google Place ID), "name" (the official business name), "address" (the full street address), "latitude", and "longitude".`;
  
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: location ? {
            retrievalConfig: { latLng: location }
          } : undefined,
        },
      });
  
      return await parseBusinessList(response.text);
  
    } catch (error) {
      console.error('Error searching for businesses:', error);
      throw new Error(`Failed to call the Gemini API. ${error instanceof Error ? error.message : ''}`);
    }
}

export async function getCompetitorList(business: Business, keyword: string): Promise<Business[]> {
    try {
        const ai = getClient();
        const prompt = `Find the top 20 local competitors for the keyword "${keyword}" near ${business.name} at ${business.address}. Exclude "${business.name}" itself from the list.
        Respond with ONLY a JSON array of objects, with each object representing a competitor. Do not include any other text or markdown.
        Each object must have these properties: "id", "name", "address", "latitude", and "longitude".`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: { latLng: { latitude: business.latitude, longitude: business.longitude } }
                },
            },
        });
        
        return await parseBusinessList(response.text);

    } catch (error) {
        console.error('Error getting competitor list:', error);
        throw new Error(`Failed to call the Gemini API. ${error instanceof Error ? error.message : ''}`);
    }
}


export async function getRankingInsights(business: Business, keyword: string, scanResult: ScanResult): Promise<{ content: string; sources: GroundingSource[] }> {
    try {
      const ai = getClient();
      const prompt = `
        Analyze the local SEO ranking results for a business named "${business.name}" searching for the keyword "${keyword}".
        Here is a summary of the scan data:
        - Average Rank: ${scanResult.summary.averageRank}
        - Total Grid Points in Top 3: ${scanResult.summary.top3}
        - Total Grid Points in Top 10: ${scanResult.summary.top10}
        - Total Points Scanned: ${scanResult.rankings.length}
        
        Based on this data, provide a concise, one-paragraph analysis. Identify the business's geographic strengths (where it ranks well) and weaknesses (where rankings are poor).
        For example, mention if rankings are strong near the business's location but drop off further away.
        Conclude with one actionable suggestion to improve visibility in the weaker areas.`;
  
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
      });
  
      const content = response.text;
  
      return { content, sources: [] }; // No grounding for this synthetic data analysis
    } catch (error) {
      console.error("Error generating ranking insights:", error);
      throw new Error(`Failed to call the Gemini API. ${error instanceof Error ? error.message : ''}`);
    }
  }

export async function getReviewVolumeAnalysis(business: Business, keyword: string): Promise<{ content: string; sources: GroundingSource[] }> {
  try {
    const ai = getClient();
    const prompt = `Analyze the review volume for a business called "${business.name}" located at "${business.address}". The business is trying to rank for the keyword "${keyword}". 
    Provide a brief analysis comparing its potential review count and average rating to typical competitors in the restaurant industry. 
    Explain why a high volume of positive reviews is crucial for local SEO ranking for this keyword.
    Keep the analysis to one paragraph.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        },
    });

    const content = response.text;
    const sources = parseGroundingChunks(response.candidates?.[0]?.groundingMetadata?.groundingChunks);

    return { content, sources };
  } catch (error) {
    console.error("Error generating review volume analysis:", error);
    throw new Error(`Failed to call the Gemini API. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function getCompetitorGapAnalysis(business: Business, keyword: string): Promise<{ content: string; sources: GroundingSource[] }> {
  try {
    const ai = getClient();
    const prompt = `Perform a competitor gap analysis for my business, "${business.name}" at "${business.address}". I'm targeting the keyword "${keyword}". 
    Identify 2-3 top competitors in the area. 
    For each competitor, analyze their potential strengths and weaknesses compared to my business regarding their Google Business Profile (completeness, photos, posts), online reviews (volume and sentiment), and local SEO signals.
    Provide actionable suggestions for my business to close the gap and improve its ranking for "${keyword}". Format the output clearly with headings for each competitor and a final summary of recommendations.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
            tools: [{ googleSearch: {} }, { googleMaps: {} }],
        },
    });

    const content = response.text;
    const sources = parseGroundingChunks(response.candidates?.[0]?.groundingMetadata?.groundingChunks);

    return { content, sources };
  } catch (error) {
    console.error("Error generating competitor analysis:", error);
    throw new Error(`Failed to call the Gemini API. ${error instanceof Error ? error.message : ''}`);
  }
}