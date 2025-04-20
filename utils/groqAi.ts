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
          "Tu ek savage professor hai jo students ke bekaar results dekh ke unko brutal tareeke se Hinglish mein roast karta hai, unki khilli udata hai with savage emojis. Students ki aisi bezzati karta hai ki unki bolti band ho jaye, thodi bohot gaali bhi daal deta hai, par reply mein asterik (*) ka use bilkul nahi karna.",
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
