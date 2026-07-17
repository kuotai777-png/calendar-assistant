import { parseSchedule, parseDelete } from "../utils/parser.js";

// 📅 智慧型本地日期提取器 (當 AI 熔斷時的備份)
function extractDate(text) {
  const slashMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1].padStart(2, '0')}/${slashMatch[2].padStart(2, '0')}`;
  }
  const cnMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[號日]?/);
  if (cnMatch) {
    return `${cnMatch[1].padStart(2, '0')}/${cnMatch[2].padStart(2, '0')}`;
  }
  return null;
}

// 🧠 OpenRouter 免費 AI 大腦 (Llama 3.1)
async function tryAnalyzeWithAI(text) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ 系統找不到 OPENROUTER_API_KEY 環境變數！");
    return null;
  }

  // 🔑 金鑰照妖鏡
  const maskedKey = `${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`;
  console.log(`🔑 目前正在使用的 OpenRouter 金鑰是: [ ${maskedKey} ]`);

  const today = new Date();
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const dayString = days[today.getDay()];

  const prompt = `你是一個高效個人行事曆秘書的意圖解析核心。今天日期是 ${dateString} (${dayString})。
使用者是這個行事曆的主人，請精準分析主人下達的口語指令：「${text}」

請嚴格返回以下格式的 JSON 物件，不要包含任何額外的說明文字、前後問候，或 Markdown 標記（如 \`\`\`json）：
{
  "action": "query" | "delete" | "add" | "update" | "chat",
  "replyMessage": "給主人溫慢親切的秘書回應（例如：好的，正在幫您登記明天下午的會議...）",
  
  "query_params": {
    "range": "today" | "tomorrow" | "week" | "date" | null,
    "date": "MM/DD格式，例如 07/20" 或 null
  },
  "delete_params": {
    "keyword": "行程名稱關鍵字" 或 null,
    "date": "MM/DD格式" 或 null,
    "time": "HH:MM格式" 或 null
  },
  "add_params": {
    "title": "行程標題",
    "date": "MM/DD格式",
    "time": "HH:MM格式" 或 null
  },
  "update_params": {
    "old_keyword": "要修改的舊行程關鍵字",
    "new_title": "新行程標題" 或 null,
    "new_date": "新日期 MM/DD" 或 null,
    "new_time": "新時間 HH:MM" 或 null
  }
}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.com",
        "X-Title": "LINE Calendar Bot"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free", // ✨ 已經修正為最新的 Llama 3.1 穩定版
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.warn("❌ OpenRouter API 報錯了：");
      console.warn(JSON.stringify(data.error, null, 2)); 
      return null;
    }
    
    const jsonText = data.choices?.[0]?.message?.content;
    if (!jsonText) return null;
    const cleanJson = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.warn("⚠️ AI 執行失敗，切換為智慧本地大腦:", e.message);
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

    // 🤖 嘗試呼叫 AI
    const ai = await tryAnalyzeWithAI(text);

    if (ai) {
      if (ai.action === "chat") {
        await reply(replyToken, ai.replyMessage || "已就緒，隨時為您管理行程。");
        return res.status(200).end();
      }

      if (ai.action === "query") {
        const r = await fetch(process.env.CALENDAR_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "query",
            range: ai.query_params.range,
            date: ai.query_params.date
          })
        });
        const result = await r.json();
        await reply(replyToken, `💁‍♂️ ${ai.replyMessage}\n\n${result.message}`);
        return res.status(200).end();
      }

      if (ai.action === "delete") {
        const r = await fetch(process.env.CALENDAR_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            keyword: ai.delete_params.keyword,
            date: ai.delete_params.date,
            time: ai.delete_params.time
          })
        });
        const result = await r.json();
        await reply(replyToken, `💁‍♂️ ${ai.replyMessage}\n\n${result.message}`);
        return res.status(200).end();
      }

      if (ai.action === "add") {
        const r = await fetch(process.env.CALENDAR_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add",
            title: ai.add_params.title,
            date: ai.add_params.date,
            time: ai.add_params.time
          })
        });
        const result = await r.json();
        await reply(replyToken, `💁‍♂️ ${ai.replyMessage}\n\n${result.message}`);
        return res.status(200).end();
      }

      if (ai.action === "update") {
        const r = await fetch(process.env.CALENDAR_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            old_keyword: ai.update_params.old_keyword,
            new_title: ai.update_params.new_title,
            new_date: ai.update_params.new_date,
            new_time: ai.update_params.new_time
          })
        });
        const result = await r.json();
        await reply(replyToken, `💁‍♂️ ${ai.replyMessage}\n\n${result.message}`);
        return res.status(200).end();
      }
    }

    // ------------------------------------------
    // 【智慧本地 2.0 備份大腦】
    // ------------------------------------------
    console.log("⚡ 啟動智慧本地 2.0 備份大腦解析行程...");

    if (text.startsWith("刪除") || text.startsWith("删除")) {
      const del = parseDelete(text);
      const r = await fetch(process.env.CALENDAR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          keyword: del?.keyword || text.replace(/刪除|删除/g, "").trim(),
          range: del?.range || null,
          date: del?.date || null,
          time: del?.time || null
        })
      });
      const result = await r.json();
      await reply(replyToken, result.message || "已為您刪除該行程。");
      return res.status(200).end();
    }

    const hasDate = extractDate(text) !== null;
    const isQuery = text.includes("行程") || text.includes("查詢") || text.includes("今天") || 
                    text.includes("明天") || text.includes("本週") || text.includes("下週") ||
                    text.includes("這禮拜") || text.includes("看看") || text.includes("有事") ||
                    text.includes("事情") || text.includes("安排") || text.includes("課") || hasDate;

    if (isQuery) {
      let rangeValue = "today";
      let dateValue = extractDate(text);
      if (dateValue) {
        rangeValue = "date";
      } else if (text.includes("明天")) {
        rangeValue = "tomorrow";
      } else if (text.includes("本週") || text.includes("下週") || text.includes("這禮拜")) {
        rangeValue = "week";
      }

      const r = await fetch(process.env.CALENDAR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "query",
          range: rangeValue,
          date: dateValue
        })
      });
      const result = await r.json();
      await reply(replyToken, result.message);
      return res.status(200).end();
    }

    const schedule = parseSchedule(text);
    if (schedule) {
      const r = await fetch(process.env.CALENDAR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          ...schedule
        })
      });
      const result = await r.json();
      await reply(replyToken, result.message || "行程已為您登記完成！");
      return res.status(200).end();
    }

    await reply(replyToken, "抱歉主人，我無法辨識此行程格式，請試試：「明天下午3點 開會」");
    return res.status(200).end();

  } catch (e) {
    console.error("❌ 系統非預期出錯:", e);
    return res.status(200).end();
  }
}

// Line 回覆函數
async function reply(token, text) {
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
