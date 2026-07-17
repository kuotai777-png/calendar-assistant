import { parseSchedule, parseDelete } from "../utils/parser.js";

// 🚀 新增：利用 Gemini 進行「聽懂人話」的語意分析模組
async function analyzeIntentWithAI(text) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null; // 如果沒設定 API Key，自動切回舊的關鍵字模式

  const today = new Date();
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const dayString = days[today.getDay()];

  const prompt = `你是一個班級行事曆助手的意圖解析核心。今天日期是 ${dateString} (${dayString})。
請精準分析使用者輸入的這句話：「${text}」

請嚴格返回以下格式的 JSON 物件，不要包含任何額外的說明文字或 Markdown 標記：
{
  "action": "query" | "delete" | "add" | "chat",
  "range": "today" | "tomorrow" | "week" | "date" | null,
  "date": "MM/DD格式" 或 null,
  "replyMessage": "僅在 action 為 chat 時填寫溫暖的回覆，其餘留空"
}

【意圖判斷規則】
1. 查詢 (query)：只要對方想了解、確認、看某段時間的行程或活動（例如：「下禮拜有要帶什麼嗎」、「明天有事嗎」、「7/20要考試嗎」、「今天有活動嗎」、「這週的考程」）。
   - 請依據今天日期精準計算出 range。如果是這禮拜/下週，range 為 "week"；如果是特定日期，range 為 "date"，且必須將該日期轉換為 "MM/DD" 格式（例如 7月25日 轉為 "07/25"）。
2. 刪除 (delete)：明確表達要刪除或取消行程（例如：「刪除明天的會議」）。
3. 新增 (add)：明確要登記、記錄新行程（例如：「明天下午3點開會」）。
4. 聊天 (chat)：一般的打招呼、謝謝、讚美或是無關行程的日常對話（例如：「哈囉」、「謝謝老師」、「辛苦了」）。請在 replyMessage 欄位以302班級小助手的溫暖口吻直接回覆。`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );
    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("Gemini 語意解析失敗，切換回傳統模式:", e);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {
    const event = req.body.events?.[0];
    if (!event || event.type !== "message") {
      return res.status(200).end();
    }

    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    // 🤖 啟動 AI 進行意圖過濾
    const aiResult = await analyzeIntentWithAI(text);

    // ======================
    // 溫暖日常閒聊處理 (大幅優化體驗，不再誤判為看不懂行程)
    // ======================
    if (aiResult && aiResult.action === "chat") {
      await reply(replyToken, aiResult.replyMessage || "您好！我是 302 班級小助手，隨時可以幫您查詢班級行程喔！");
      return res.status(200).end();
    }

    // ======================
    // 刪除行程
    // ======================
    if (text.startsWith("刪除") || text.startsWith("删除") || (aiResult && aiResult.action === "delete")) {
      const del = parseDelete(text);
      const r = await fetch(
        process.env.CALENDAR_API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            keyword: del.keyword,
            range: del.range,
            date: del.date,
            time: del.time
          })
        }
      );

      const result = await r.json();
      await reply(replyToken, result.message || JSON.stringify(result.events));
      return res.status(200).end();
    }

    // ======================
    // 查詢行程 (智慧語意升級版 🌟)
    // ======================
    if ((aiResult && aiResult.action === "query") || text.includes("行程") || text.includes("查詢")) {
      
      // 🚀 核心優化：優先採用 AI 解析出來的範圍與日期；若 AI 失效，則自動切換回原本的硬字串比對（雙層保險）
      const rangeValue = aiResult?.range || (
        text.includes("明天") ? "tomorrow" : 
        text.includes("本週") ? "week" : 
        text.match(/\d{1,2}\/\d{1,2}/) ? "date" : "today"
      );
      
      const dateValue = aiResult?.date || (
        text.match(/\d{1,2}\/\d{1,2}/) ? text.match(/\d{1,2}\/\d{1,2}/)[0] : null
      );

      const r = await fetch(
        process.env.CALENDAR_API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "query",
            range: rangeValue,
            date: dateValue
          })
        }
      );

      const result = await r.json();
      await reply(replyToken, result.message);
      return res.status(200).end();
    }

    // ======================
    // 新增行程 (原本的 fall-through 邏輯)
    // ======================
    const schedule = parseSchedule(text);

    if (!schedule) {
      await reply(
        replyToken,
        "我看不懂這個行程時間，請試試：\n明天下午3點 開會"
      );
      return res.status(200).end();
    }

    const r = await fetch(
      process.env.CALENDAR_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "add",
          ...schedule
        })
      }
    );

    const result = await r.json();
    await reply(replyToken, result.message || "新增完成");
    return res.status(200).end();

  } catch (e) {
    console.log(e);
    return res.status(200).end();
  }
}

// ======================
// LINE reply 保持不變
// ======================
async function reply(token, text) {
  await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.LINE_CHANNEL_ACCESS_TOKEN
      },
      body: JSON.stringify({
        replyToken: token,
        messages: [
          {
            type: "text",
            text
          }
        ]
      })
    }
  );
}
