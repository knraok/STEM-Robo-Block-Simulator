
import { GoogleGenAI } from "@google/genai";
import { Block, HardwareConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const explainCode = async (blocks: Block[], config: HardwareConfig) => {
  if (blocks.length === 0) return "Add some blocks to your program first!";

  const programText = blocks.map((b, i) => 
    `${i + 1}. ${b.type} for ${b.duration}s at ${b.speed}% speed`
  ).join('\n');

  const prompt = `
    You are a friendly STEM Robotics Educator. 
    Explain this sequence of robot movements to a 10-year-old child and their parents.
    Use analogies about driving or walking.
    
    Technical Details to include:
    - The Transmitter (Joystick) has MAC Address: ${config.transmitterMac || 'Unknown'}
    - The Receiver (4WD Car) has MAC Address: ${config.receiverMac || 'Unknown'}
    - Explain how ESP-NOW uses these specific "digital IDs" (MAC addresses) to talk directly without a router.
    
    Program:
    ${programText}
    
    Keep it encouraging and educational. Limit to 3 short paragraphs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The AI educator is currently offline, but your code looks great! The robot will follow your instructions step-by-step using your configured MAC addresses.";
  }
};
