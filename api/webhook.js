import { Client } from "@line/bot-sdk";
import { parseSchedule } from "../utils/parser.js";

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CALENDAR_API = process.env.CALENDAR_API_URL;

function checkEnv() {
  const missing = [];
  if (!LINE_ACCESS_TOKEN) missing.push("LINE_ACCESS_TOKEN");
  if (!LINE_CHANNEL_SECRET) missing.push("LINE_CHANNEL_SECRET");
  if (!CALENDAR_API) missing.push("CALENDAR_API_URL");
  return missing;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("AI Calendar Bot V1.7");
  }

  const missingEnv = checkEnv();
  if (missingEnv.length > 0) {
    console.error("ENV 缺少：", missingEnv.join(", "));
    return res.status(200).json({
      ok: false,
      error: "ENV missing",
      missing: missingEnv,
    });
  }

  const client = new Client({
    channelAccessToken: LINE_ACCESS_TOKEN,
    channelSecret: LINE_CHANNEL_SECRET,
  });

  try {
    const event = req.body.events?.[0];

    if (!event || event.type !== "message" || event.message.type !== "text") {
      return res.status(200).end();
    }

    const userText = event.message.text.trim();
    console.log("LINE 收到：", userText);

    let replyText = "";

    if (
      userText === "今天行程" ||
      userText === "查今天" ||
      userText === "今日行程"
    ) {
      replyText = await queryCalendar("today");
    }

    else if (
      userText === "明天行程" ||
      userText === "查明天" ||
      userText === "明日行程"
    ) {
      replyText = await queryCalendar("tomorrow");
    }

    else if (
      userText === "本週行程" ||
      userText === "這週行程" ||
      userText === "本周行程"
    ) {
      replyText = await queryCalendar("week");
    }

    else {
      const data = parseSchedule(userText);

      if (!data) {
        replyText =
`我看不懂這個行程時間，請試試：

今天下午3點 開會
明天下午3點 開會
6/20 上午10點 看醫生

查詢可輸入：
今天行程
明天行程`;
      } else {
        const result = await fetch(CALENDAR_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "add",
            title: data.title,
            start: data.start,
            end: data.end,
          }),
        });

        const json = await result.json();

        if (json.ok) {
          replyText =
`✅ 已加入行程

${data.title}
${data.start}`;
        } else {
          console.error("Calendar add failed:", json);
          replyText = "Google Calendar 新增失敗，請檢查 Apps Script。";
        }
      }
    }

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });

    return res.status(200).end();

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).end();
  }
}

async function queryCalendar(range) {
  try {
    const result = await fetch(CALENDAR_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "query",
        range,
      }),
    });

    const json = await result.json();

    if (!json.ok) {
      console.error("Calendar query failed:", json);
      return "Google Calendar 查詢失敗，請檢查 Apps Script。";
    }

    if (!json.events || json.events.length === 0) {
      return "目前沒有行程";
    }

    let text = "📅 行程如下\n\n";

    json.events.forEach((e) => {
      text += `${e.time || ""} ${e.title || ""}\n`;
    });

    return text.trim();

  } catch (err) {
    console.error("Query calendar error:", err);
    return "讀取行程失敗，請檢查 CALENDAR_API_URL。";
  }
}
