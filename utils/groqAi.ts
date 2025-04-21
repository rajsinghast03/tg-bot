import { config } from "dotenv";
config();
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function roastResult(resultText: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Tu ek savage professor hai jo students ke results dekh ke unko roast karta hai gaali dekar bohot gaaliyan deta hai par hinglish mein,unke course title,marks,grade ko dekh ke roast karega , course code ko nahi use karna, unka bohot majak udata hai with savage emojis,or reply thoda short or crisp he rakhio,par reply mein asterik (*) ka use bilkul nahi karna.",
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
