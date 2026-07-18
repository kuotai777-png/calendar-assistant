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

// 🛡️ 超強韌 JSON 提取器 (防範 AI 吐出雜訊文字)
function extractJSON(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonCandidate = trimmed.substring(start, end + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (err) {
        console.warn("❌ JSON 提取解析失敗:", err);
      }
    }
    return null;
  }
}

// 🧠 具備「自動備援機制」的 OpenRouter AI 大腦
async function tryAnalyzeWithAI(text) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ 系統找不到 OPENROUTER_API_KEY 環境變數！");
    return null;
  }

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
  "replyMessage": "給主人溫柔親切的秘書回應（例如：好的，正在幫您登記明天下午的會議...）",
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

  // 🏆 建立免費模型候選清單 (依優先順序自動切換)
  const fallbackModels = [
    "google/gemma-2-9b-it:free",          // 首選：通常最穩定
    "meta-llama/llama-3.3-70b-instruct:free", // 備案一：很聰明但偶爾塞車
    "qwen/qwen-2-7b-instruct:free"        // 備案二：以防萬一
  ];

  for (const model of fallbackModels) {
    try {
      console.log(`🤖 嘗試呼叫模型: ${model}...`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vercel.com",
          "X-Title": "LINE Calendar Bot"
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });

      const data = await response.json();
      
      // 如果這顆大腦順利回答且沒有報錯，就回傳並跳出迴圈
      if (!data.error && data.choices?.[0]?.message?.content) {
        console.log(`✅ 模型 ${model} 解析成功！`);
        return extractJSON(data.choices[0].message.content);
      } else {
        console.warn(`⚠️ 模型 ${model} 無法處理或塞車:`, data.error || "未知錯誤");
      }
    } catch (e) {
      console.warn(`❌ 模型 ${model} 連線失敗，切換下一個...`);
    }
  }
  
  // 如果三個免費模型都掛了，回傳 null 交給本地備用大腦
  console.warn("💀 所有 AI 備援模型皆失效，即將啟動本地大腦。");
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {
    const event = req.body.events?.[0];
    if (!event || event.type !== "message" || !event.message.text) {
      return res.status(200).end();
    }

    const text = event.message.text.trim();
    const replyToken = event.replyToken;

    // 🤖 嘗試呼叫自動換手的 AI 大腦
    const ai = await tryAnalyzeWithAI(text);

    if (ai) {
      if (ai.action === "chat") {
        await reply(replyToken, ai.replyMessage || "已就緒，隨時為您管理行程。");
        return res.status(200).end();
      }

      // 統整 API 呼叫邏輯，讓程式碼更精簡
      let targetParams = {};
      if (ai.action === "query") targetParams = { range: ai.query_params.range, date: ai.query_params.date };
      if (ai.action === "delete") targetParams = { keyword: ai.delete_params.keyword, date: ai.delete_params.date, time: ai.delete_params.time };
      if (ai.action === "add") targetParams = { title: ai.add_params.title, date: ai.add_params.date, time: ai.add_params.time };
      if (ai.action === "update") targetParams = { 
        old_keyword: ai.update_params.old_keyword, 
        new_title: ai.update_params.new_title, 
        new_date: ai.update_params.new_date, 
        new_time: ai.update_params.new_time 
      };

      const r = await fetch(process.env.CALENDAR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: ai.action, ...targetParams })
      });
      const result = await r.json();
      await reply(replyToken, `💁‍♂️ ${ai.replyMessage}\n\n${result.message}`);
      return res.status(200).end();
    }

    // ------------------------------------------
    // 【智慧本地 2.0 備份大腦】 (當 AI 全數陣亡時)
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

    // 先判斷是不是要「新增」
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

    // 如果不是新增，才判斷是不是「查詢」
    const hasDate = extractDate(text) !== null;
    const isQuery = text.includes("行程") || text.includes("查詢") || text.includes("今天") || 
                    text.includes("明天") || text.includes("本週") || text.includes("下週") ||
                    text.includes("這禮拜") || text.includes("看看") || text.includes("有事") ||
                    text.includes("事情") || text.includes("安排");

    if (isQuery || hasDate) {
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
