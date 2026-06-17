import { parseSchedule } from "../utils/parser.js";

const LINE_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN;

const CALENDAR_API_URL =
  process.env.CALENDAR_API_URL;

//=====================
// 主入口
//=====================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const text = event.message.text.trim();
      const userId = event.source?.userId || "";

      console.log("LINE 收到:", text);
      console.log("LINE userId:", userId);

      // V1.5：記錄 userId，供主動推播使用
      if (userId) {
        await api({
          action: "registerUser",
          userId
        });
      }

      let reply;

      if (isQuery(text)) {
        reply = await query(text);
      }

      else if (text.startsWith("刪除")) {
        reply = await remove(text);
      }

      else if (
        text.startsWith("把") &&
        text.includes("改成")
      ) {
        reply = await update(text);
      }

      else {
        reply = await add(text);
      }

      await replyLine(event.replyToken, reply);
    }

    return res.status(200).json({
      ok: true
    });

  } catch (e) {
    console.error(e);

    return res.status(200).json({
      ok: false,
      error: e.message
    });
  }
}

//=====================
// 查詢判斷
//=====================

function isQuery(text) {
  return (
    text.includes("查詢") ||
    text.includes("看行程")
  );
}

//=====================
// 查詢
//=====================

async function query(text) {
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

  const r = await api({
    action: "query",
    target
  });

  return r.message || "查詢完成";
}

//=====================
// 新增
//=====================

async function add(text) {
  const p = parseSchedule(text);

  if (!p) {
    return "無法辨識時間，請試試：今天下午3點 開會";
  }

  const r = await api({
    action: "add",
    title: p.title,
    start: p.start,
    end: p.end
  });

  return r.message || "已新增";
}

//=====================
// 刪除
//=====================

async function remove(text) {
  const keyword = text
    .replace("刪除", "")
    .trim();

  if (!keyword) {
    return "請輸入要刪除的行程名稱";
  }

  const r = await api({
    action: "delete",
    keyword
  });

  return r.message || "刪除完成";
}

//=====================
// 修改
//=====================

async function update(text) {
  const temp = text
    .replace("把", "")
    .split("改成");

  const keyword = temp[0]?.trim() || "";
  const newTime = temp[1]?.trim() || "";

  if (!keyword || !newTime) {
    return "請輸入完整格式：把客戶會議改成下午5點";
  }

  const r = await api({
    action: "update",
    keyword,
    newTime
  });

  return r.message || "修改完成";
}

//=====================
// Apps Script API
//=====================

async function api(data) {
  if (!CALENDAR_API_URL) {
    return {
      success: false,
      message: "CALENDAR_API_URL 尚未設定"
    };
  }

  const res = await fetch(CALENDAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Apps Script 回傳錯誤:", text);
    return {
      success: false,
      message: "Apps Script 回傳格式錯誤"
    };
  }
}

//=====================
// LINE 回覆
//=====================

async function replyLine(token, text) {
  const res = await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + LINE_ACCESS_TOKEN
      },
      body: JSON.stringify({
        replyToken: token,
        messages: [
          {
            type: "text",
            text: text || "完成"
          }
        ]
      })
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("LINE 回覆失敗:", errorText);
  }
}
