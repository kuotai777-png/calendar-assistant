import { Client } from "@line/bot-sdk";
import { parseSchedule, parseDelete } from "../utils/parser.js";

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
    return res.status(200).send("AI Calendar Bot V1.8");
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

console.log(
  "LINE_USER_ID：",
  event.source.userId
);

    let replyText = "";

    // 查詢
    if (["今天行程", "查今天", "今日行程"].includes(userText)) {
      replyText = await queryCalendar("today");
    }

    else if (["明天行程", "查明天", "明日行程"].includes(userText)) {
      replyText = await queryCalendar("tomorrow");
    }

    else if (["本週行程", "這週行程", "本周行程"].includes(userText)) {
      replyText = await queryCalendar("week");
    }

    // 刪除
    else if (userText.startsWith("刪除") || userText.startsWith("删除")) {
      const data = parseDelete(userText);

      if (!data.keyword) {
        replyText =
`請輸入要刪除的行程名稱，例如：

刪除 開會
刪除今天 開會
刪除明天 吃飯`;
      } else {
        replyText = await deleteCalendar(data.range, data.keyword);
      }
    }

    // 新增
    else {
      const data = parseSchedule(userText);

      if (!data) {
        replyText =
`我看不懂這個行程時間，請試試：

新增：
今天下午3點 開會
明天下午5點 吃飯
6/20 上午10點 看醫生

查詢：
今天行程
明天行程
本週行程

刪除：
刪除 開會
刪除今天 開會
刪除明天 吃飯`;
      } else {
        replyText = await addCalendar(data);
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

async function addCalendar(data) {
  try {
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
      return `✅ 已加入行程\n\n${data.title}\n${data.displayTime}`;
    }

    console.error("Calendar add failed:", json);
    return `Google Calendar 新增失敗：${json.error || "未知錯誤"}`;

  } catch (err) {
    console.error("Add calendar error:", err);
    return "Google Calendar 新增失敗，請檢查 CALENDAR_API_URL。";
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
      return `Google Calendar 查詢失敗：${json.error || "未知錯誤"}`;
    }

    if (!json.events || json.events.length === 0) {
      return "目前沒有行程";
    }

    let text = "📅 行程如下\n\n";

    json.events.forEach((e, index) => {
      text += `${index + 1}. ${e.time} ${e.title}\n`;
    });

    return text.trim();

  } catch (err) {
    console.error("Query calendar error:", err);
    return "讀取行程失敗，請檢查 CALENDAR_API_URL。";
  }
}

async function deleteCalendar(range, keyword) {
  try {
    const result = await fetch(CALENDAR_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "delete",
        range,
        keyword,
      }),
    });

    const json = await result.json();

    if (!json.ok) {
      console.error("Calendar delete failed:", json);
      return `刪除失敗：${json.error || "未知錯誤"}`;
    }

    if (json.deleted === 0) {
      return `找不到符合「${keyword}」的行程`;
    }

    return `🗑️ 已刪除 ${json.deleted} 筆行程：${keyword}`;

  } catch (err) {
    console.error("Delete calendar error:", err);
    return "刪除行程失敗，請檢查 Apps Script。";
  }
}
