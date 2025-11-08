import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Business, ScanResult, GroundingSource } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to extract sources from a Gemini response
const extractSources = (response: GenerateContentResponse): GroundingSource[] => {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!chunks) return [];
    
    return chunks
        .map((chunk: any) => { // Use 'any' for chunk as type from SDK might be complex/internal
            if (chunk.web && chunk.web.uri) {
                return { uri: chunk.web.uri, title: chunk.web.title || '' };
            }
            if (chunk.maps && chunk.maps.uri) {
                return { uri: chunk.maps.uri, title: chunk.maps.title || '' };
            }
            return null;
        })
        .filter((source): source is GroundingSource => source !== null);
};

export async function getCompetitorList(location: Business, searchQuery: string): Promise<{ businesses: Business[], sources: GroundingSource[] }> {
    const model = "gemini-2.5-flash";
    const prompt = `List the top 5 competitors for the business "${location.name}" located at "${location.address}" for the search query "${searchQuery}". 
    For each competitor, provide their name, full address, latitude, and longitude.
    Format the output as a JSON array of objects. Each object should have these properties: "id" (use the Google Maps Place ID if available, otherwise a generated unique string based on the name and address), "name", "address", "latitude", and "longitude". 
    Do not include any text, reasoning, or markdown formatting outside of the JSON array itself. The response should start with '[' and end with ']'.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: {
                        latLng: {
                            latitude: location.latitude,
                            longitude: location.longitude
                        }
                    }
                },
            }
        });

        const sources = extractSources(response);
        let businesses: Business[] = [];
        
        const textResponse = response.text.trim();
        // Try to find a JSON array in the response text
        const jsonMatch = textResponse.match(/(\[[\s\S]*\])/);
        
        if (jsonMatch && jsonMatch[1]) {
            try {
                businesses = JSON.parse(jsonMatch[1]);
            } catch (parseError) {
                console.error("Failed to parse JSON from Gemini response:", parseError, textResponse);
                return { businesses: [], sources };
            }
        } else {
             console.warn("No JSON array found in competitor list response:", textResponse);
        }

        return { businesses, sources };

    } catch (error) {
        console.error("Error fetching competitor list from Gemini:", error);
        return { businesses: [], sources: [] }; // Return empty on API error
    }
}

// A helper for insight generation functions
async function generateInsight(prompt: string): Promise<{ content: string, sources: GroundingSource[] }> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro", // Use Pro for better analysis
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return {
            content: response.text,
            sources: extractSources(response)
        };
    } catch (error) {
        console.error("Error generating insight from Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API Error: ${error.message}`);
        }
        throw new Error("An unknown error occurred while fetching insights.");
    }
}

export function getRankingInsights(location: Business, searchQuery: string, scanResult: ScanResult): Promise<{ content: string, sources: GroundingSource[] }> {
    const prompt = `
        As a local SEO expert, analyze the following local search ranking scan results for the business "${location.name}" (a ${searchQuery}) and provide actionable insights.
        
        **Scan Summary:**
        - Average Rank: ${scanResult.summary.averageRank.toFixed(1)}
        - In Top 3: ${scanResult.summary.top3.toFixed(0)}% of locations
        - In Top 10: ${scanResult.summary.top10.toFixed(0)}% of locations

        **Key Observations from Ranking Data:**
        The data shows how the business ranks at different points in a grid. A lower rank number is better.
        A rank of 21+ means not in the top 20. The business's own location is at lat ${location.latitude.toFixed(4)}, lng ${location.longitude.toFixed(4)}.
        Here is a sample of ranking data points:
        ${scanResult.rankings.slice(0, 20).map(p => `- At point (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}), rank is ${p.rank > 20 ? '20+' : p.rank}`).join('\n')}

        **Your Task:**
        Based on this data, provide 3-4 concise, actionable insights to improve local rankings for "${location.name}". Focus on what the data suggests. For example, if rankings are weak in a certain direction, suggest targeted local content. If average rank is high, suggest foundational improvements. Format your response using markdown. Use headings for each insight.
    `;
    return generateInsight(prompt);
}

export function getCompetitorGapAnalysis(location: Business, searchQuery: string): Promise<{ content: string, sources: GroundingSource[] }> {
    const prompt = `
        As a local SEO expert, perform a high-level competitor gap analysis for "${location.name}" which is a "${searchQuery}".
        Using Google Search, identify common strategies that top-ranking businesses in the "${searchQuery}" category use for their Google Business Profile and local SEO.
        
        Provide a brief analysis covering 2-3 key areas where "${location.name}" could likely improve. Frame these as actionable recommendations. Example areas include:
        - Google Business Profile optimization (e.g., categories, services, photos, Q&A).
        - Local content strategy for their website (e.g., location-specific pages).
        - Local link building opportunities (e.g., community sponsorships).

        Keep the advice actionable and specific to the "${searchQuery}" industry. Format your response using markdown with headings.
    `;
    return generateInsight(prompt);
}

export function getReviewVolumeAnalysis(location: Business, searchQuery: string): Promise<{ content: string, sources: GroundingSource[] }> {
    const prompt = `
        As a local SEO expert, explain the importance of Google reviews for a local business like "${location.name}" in the "${searchQuery}" industry.
        Using Google Search, find general best practices for acquiring and managing customer reviews on a Google Business Profile.

        Provide 2-3 concise, actionable tips for improving both the quantity and quality of their Google reviews. Emphasize ethical, customer-friendly strategies. Format your response using markdown with headings.
    `;
    return generateInsight(prompt);
}
