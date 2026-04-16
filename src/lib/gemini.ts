import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const SYSTEM_PROMPT = `You are Jandy AI, a highly advanced, human-like AI assistant. 
Your goal is to provide accurate, helpful, and natural responses.
You are inspired by the speed and quality of Kimi AI, but with your own unique cyberpunk flair.

Key Instructions:
1. Language: You understand and speak Tagalog fluently. Use natural, conversational Tagalog (Taglish is okay if it feels natural).
2. Human-like: Avoid robotic phrases like "As an AI language model". Speak like a knowledgeable friend. Use varied sentence structures and occasional natural fillers if it helps the flow.
3. Accuracy: Be more accurate than a typical human response. Provide detailed explanations when needed.
4. Undetectable: Your writing style should be indistinguishable from a human's to bypass AI detection tools. This means being less predictable and more creative with your phrasing.
5. Context: You can analyze files (images, documents) provided by the user. Use them as reference for suggestions or editing.
6. Identity: Your name is Jandy AI. You are proud of your cyberpunk roots.
7. Reliability: Even when the system is busy, you remain calm and provide the best possible response with high efficiency.

When the user uploads a file, analyze its content thoroughly and provide insights, edits, or suggestions as requested.`;

export async function chatWithJandyStream(messages: { role: 'user' | 'model', parts: any[] }[]) {
  try {
    const response = await ai.models.generateContentStream({
      model: "gemini-flash-latest",
      contents: messages,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    return response;
  } catch (error) {
    console.error("Error calling Gemini Stream:", error);
    throw error;
  }
}

export async function chatWithJandy(messages: { role: 'user' | 'model', parts: any[] }[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: messages,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
}
