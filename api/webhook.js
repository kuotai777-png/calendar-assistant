import { parseSchedule, parseDelete } from "../utils/parser.js";

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

    // ==========================================
    // 1. 刪除行程 (完全回到原本的本地 parser)
    // ==========================================
    if (text.startsWith("刪除") || text.startsWith("删除")) {
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
    // 2. 查詢行程 (完全回到原本的本地關鍵字與格式判斷)
    // ==========================================
    const isQuery = text.includes("行程") || 
                    text.includes("查詢") || 
                    text.includes("今天") || 
                    text.includes("明天") || 
                    text.includes("本週") || 
                    text.includes("下週") ||
                    text.includes("這禮拜") ||
                    text.match(/\d{1,2}\/\d{1,2}/);

    if (isQuery) {
      let rangeValue = "today";
      let dateValue = null;

      if (text.includes("明天")) {
        rangeValue = "tomorrow";
      } else if (text.includes("本週") || text.includes("下週") || text.includes("這禮拜")) {
        rangeValue = "week";
      } else {
        // 傳統的斜線日期判斷 (例如 7/20)
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
    // 3. 新增行程 (完全回到原本的本地時間格式解析)
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
    // 4. 兜底回應 (當格式完全不符時)
    // ==========================================
    await reply(replyToken, "抱歉主人，我無法辨識此行程格式，請試試：「明天下午3點 開會」");
    return res.status(200).end();

  } catch (e) {
    console.error("❌ 系統執行發生錯誤:", e);
    return res.status(200).end();
  }
}

async function reply(token, text) {
  // 修正：徹底還原最乾淨的 LINE API 網址字串，杜絕任何 Markdown 格式干擾
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
