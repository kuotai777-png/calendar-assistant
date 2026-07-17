import { parseSchedule, parseDelete } from "../utils/parser.js";

// 🧠 安全的 AI 輔助解析（失敗時不崩潰，默默返回 null）
async function tryAnalyzeWithAI(text) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const today = new Date();
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const dayString = days[today.getDay()];

  const prompt = `你是一個高效個人行事曆秘書的意圖解析核心。今天日期是 ${dateString} (${dayString})。
使用者是這個行事曆的主人，請精準分析主人下達的個人行程指令：「${text}」

請嚴格返回以下格式的 JSON 物件，不要包含任何額外的說明文字或 Markdown 標記：
{
  "action": "query" | "delete" | "add" | "chat",
  "range": "today" | "tomorrow" | "week" | "date" | null,
  "date": "MM/DD格式" 或 null,
  "replyMessage": "僅在 action 為 chat 時填寫簡短的秘書回覆，其餘禮貌留空"
}

【意圖判斷規則】
1. 查詢 (query)：主人想要確認、查看自己的行程（例如：「我明天有事嗎」、「查下週二行程」、「這禮拜有排行程嗎」、「7/20有什麼事」）。
   - 請依據今天日期精準計算出 range。如果是這禮拜/下週，range 為 "week"；如果是特定日期，range 為 "date"，且必須將該日期轉換為 "MM/DD" 格式（例如 7月25日 轉為 "07/25"）。
2. 刪除 (delete)：主人明確表達要刪除或取消某個行程（例如：「刪除明天的會議」、「取消7/20的看診」）。
3. 新增 (add)：主人想要登記、記錄、新增一個行程（例如：「幫我記下明天下午3點開會」、「7/20 早上9點去醫院」）。
4. 聊天 (chat)：主人一般的測試或打招呼（例如：「測試」、「哈囉」、「謝謝」）。`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );
    const data = await response.json();
    if (data.error) {
      console.warn("⚠️ Gemini API 暫不可用 (Quota 或 Key 問題)，切換回本地 parser。");
      return null;
    }
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) return null;
    const cleanJson = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.warn("⚠️ Gemini 執行失敗，默默切換回本地 parser:", e.message);
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

    // 🤖 嘗試取得 AI 解析結果 (僅作為輔助，失敗時不影響原有系統運作)
    const aiResult = await tryAnalyzeWithAI(text);

    // ==========================================
    // 系統回應測試 (僅在 AI 活著且判斷為聊天時觸發)
    // ==========================================
    if (aiResult && aiResult.action === "chat") {
      await reply(replyToken, aiResult.replyMessage || "已就緒，隨時可以為您管理個人行程。");
      return res.status(200).end();
    }

    // ==========================================
    // 1. 刪除行程 (AI 判斷或傳統關鍵字判斷)
    // ==========================================
    const isDelete = (aiResult && aiResult.action === "delete") || text.startsWith("刪除") || text.startsWith("删除");
    if (isDelete) {
      const del = parseDelete(text);
      const r = await fetch(
        process.env.CALENDAR_API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            keyword: del?.keyword || text.replace(/刪除|删除/g, "").trim(),
            range: del?.range || null,
            date: del?.date || null,
            time: del?.time || null
          })
        }
      );

      const result = await r.json();
      await reply(replyToken, result.message || "已為您刪除該行程。");
      return res.status(200).end();
    }

    // ==========================================
    // 2. 查詢行程 (AI 判斷或傳統關鍵字、時間詞判斷)
    // ==========================================
    const isQuery = (aiResult && aiResult.action === "query") || 
                    text.includes("行程") || 
                    text.includes("查詢") || 
                    text.includes("今天") || 
                    text.includes("明天") || 
                    text.includes("本週") || 
                    text.includes("下週");

    if (isQuery) {
      // 優先採用 AI 聰明的日期解析，若 AI 掛掉則使用原有的本地正則表達式
      let rangeValue = aiResult?.range;
      let dateValue = aiResult?.date;

      if (!rangeValue) {
        rangeValue = text.includes("明天") ? "tomorrow" : 
                     (text.includes("本週") || text.includes("下週")) ? "week" : "today";
      }
      
      if (!dateValue) {
        const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
        if (dateMatch) {
          rangeValue = "date";
          dateValue = `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}`;
        }
      }

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

    // ==========================================
    // 3. 新增行程 (預設或本地 Parser 解析成功)
    // ==========================================
    const schedule = parseSchedule(text);

    if (schedule) {
      const r = await fetch(
        process.env.CALENDAR_API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            ...schedule
          })
        }
      );

      const result = await r.json();
      await reply(replyToken, result.message || "行程已為您登記完成！");
      return res.status(200).end();
    }

    // ==========================================
    // 4. 兜底回應 (完全看不懂時)
    // ==========================================
    await reply(replyToken, "抱歉主人，我無法辨識此行程格式，請試試：「明天下午3點 開會」");
    return res.status(200).end();

  } catch (e) {
    console.error("❌ 系統非預期出錯，已攔截避免崩潰:", e);
    return res.status(200).end();
  }
}

async function reply(token, text) {
  // 修正：徹底還原最乾淨的 LINE API 網址，去除任何可能干擾的 Markdown 格式
  const lineUrl = "https://api.line.me/v2/bot/message/reply";
  await fetch(
    lineUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.LINE_CHANNEL_ACCESS_TOKEN
      },
      body: JSON.stringify({
        replyToken: token,
        messages: [{ type: "text", text }]
      })
    }
  );
}
