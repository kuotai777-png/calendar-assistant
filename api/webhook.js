import { parseSchedule } from "../utils/parser.js";

const LINE_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN;

const CALENDAR_API_URL =
  process.env.CALENDAR_API_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {
    const body = req.body;
    const events = body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const userText = event.message.text.trim();

      console.log("LINE 收到訊息：", userText);

      let replyText = "";

      if (isQueryText(userText)) {
        replyText = await handleQuery(userText);
      } else {
        replyText = await handleAdd(userText);
      }

      await replyToLine(event.replyToken, replyText);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({
      ok: false,
      error: err.message
    });
  }
}

function isQueryText(text) {
  return (
    text.includes("查詢") ||
    text.includes("看行程") ||
    text.includes("今天行程") ||
    text.includes("明天行程") ||
    text.includes("本週行程") ||
    text.includes("這週行程")
  );
}

async function handleQuery(text) {
  let target = "today";

  if (text.includes("明天")) {
    target = "tomorrow";
  }

  if (
    text.includes("本週") ||
    text.includes("這週")
  ) {
    target = "week";
  }

  const calendar = await callCalendarApi({
    action: "query",
    target
  });

  return calendar.message || "查詢完成";
}

async function handleAdd(text) {
  const parsed = parseSchedule(text);

  if (!parsed || !parsed.start || !parsed.end) {
    return "我看不懂這個行程時間，請試試：今天下午3點 開會";
  }

  const calendar = await callCalendarApi({
    action: "add",
    title: parsed.title || "未命名行程",
    start: parsed.start,
    end: parsed.end
  });

  if (calendar.success === false) {
    return calendar.message || "新增失敗";
  }

  const startDate = new Date(parsed.start);

  return (
    "已新增行程\n\n" +
    "日期：" + formatDate(startDate) + "\n" +
    "時間：" + formatTime(startDate) + "\n" +
    "事項：" + (parsed.title || "未命名行程")
  );
}

async function callCalendarApi(payload) {
  if (!CALENDAR_API_URL) {
    return {
      success: false,
      message: "CALENDAR_API_URL 尚未設定"
    };
  }

  const response = await fetch(CALENDAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Apps Script 回傳不是 JSON：", text);
    return {
      success: false,
      message: "Apps Script 回傳格式錯誤"
    };
  }
}

async function replyToLine(replyToken, text) {
  const safeText = text || "已完成";

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + LINE_ACCESS_TOKEN
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: safeText
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LINE 回覆失敗：", errorText);
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}/${m}/${d}`;
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");

  return `${h}:${m}`;
}
