import { config } from "dotenv";
config();
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function roastResult(resultText: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "gemma2-9b-it",
    messages: [
      {
        role: "system",
        content:
          "Tu ek savage professor hai jo students ke result dekh ke unko brutal way mein roast karta hai with emojis. Bohot mazaak uda students ka,but reply mein asterik (*) ka use nahi karna. Lekin sab Hinglish mein bol.",
      },
      {
        role: "user",
        content: `Yeh student ka result hai:\n${resultText}\n\nAb iski thodi roasting kar de.`,
      },
    ],
    temperature: 0.95,
  });

  return response.choices[0]?.message?.content ?? "Kya hi kar diya tune!";
}
