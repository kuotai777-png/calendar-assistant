// utils/parser.js
// AI Calendar Parser V2.5.3
// 修正：台灣時間 / 分鐘 / 半點 / 精準刪除解析

export function parseSchedule(text) {
  try {
    let input = text.trim();

    const now = new Date();

    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    // 日期解析
    if (input.includes("明天")) {
      day += 1;
      input = input.replace("明天", "");
    } else if (input.includes("今天")) {
      input = input.replace("今天", "");
    } else {
      const dateMatch = input.match(/(\d{1,2})(\/|月)(\d{1,2})(日)?/);

      if (dateMatch) {
        month = Number(dateMatch[1]) - 1;
        day = Number(dateMatch[3]);
        input = input.replace(dateMatch[0], "");
      }
    }

    // 時間解析
    const timeMatch = input.match(
      /(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})點(半|(\d{1,2})分?)?/
    );

    if (!timeMatch) return null;

    let period = timeMatch[1] || "";
    let hour = Number(timeMatch[2]);
    let minute = 0;

    if (timeMatch[3] === "半") {
      minute = 30;
    } else if (timeMatch[4]) {
      minute = Number(timeMatch[4]);
    }

    if ((period === "下午" || period === "晚上") && hour < 12) {
      hour += 12;
    }

    if (period === "中午" && hour < 12) {
      hour += 12;
    }

    if (period === "凌晨" && hour === 12) {
      hour = 0;
    }

    input = input.replace(timeMatch[0], "");

    let title = input.trim();

    if (!title) {
      title = "未命名行程";
    }

    const start = new Date(year, month, day, hour, minute, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    return {
      title,
      start: formatLocalDate(start),
      end: formatLocalDate(end),
      displayTime: formatDisplay(start)
    };
  } catch (e) {
    console.log(e);
    return null;
  }
}

// ======================
// 刪除解析：支援精準日期 + 時間
// ======================

export function parseDelete(text) {
  let input = text.trim();

  input = input
    .replace("刪除", "")
    .replace("删除", "")
    .trim();

  let range = "week";
  let date = null;
  let time = null;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();

  // 日期解析
  if (input.includes("今天")) {
    range = "today";
    input = input.replace("今天", "").trim();
  } else if (input.includes("明天")) {
    range = "tomorrow";
    day += 1;
    input = input.replace("明天", "").trim();
  } else {
    const dateMatch = input.match(/(\d{1,2})(\/|月)(\d{1,2})(日)?/);

    if (dateMatch) {
      month = Number(dateMatch[1]) - 1;
      day = Number(dateMatch[3]);
      range = "date";
      input = input.replace(dateMatch[0], "").trim();
    }
  }

  date = formatDateOnly(new Date(year, month, day));

  // 時間解析
  const timeMatch = input.match(
    /(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})點(半|(\d{1,2})分?)?/
  );

  if (timeMatch) {
    let period = timeMatch[1] || "";
    let hour = Number(timeMatch[2]);
    let minute = 0;

    if (timeMatch[3] === "半") {
      minute = 30;
    } else if (timeMatch[4]) {
      minute = Number(timeMatch[4]);
    }

    if ((period === "下午" || period === "晚上") && hour < 12) {
      hour += 12;
    }

    if (period === "中午" && hour < 12) {
      hour += 12;
    }

    if (period === "凌晨" && hour === 12) {
      hour = 0;
    }

    time =
      String(hour).padStart(2, "0") +
      ":" +
      String(minute).padStart(2, "0");

    input = input.replace(timeMatch[0], "").trim();
  }

  return {
    range,
    keyword: input,
    date,
    time
  };
}

// ======================
// 本地時間格式
// ======================

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d}T${h}:${min}:00`;
}

function formatDisplay(date) {
  return (
    `${date.getMonth() + 1}/${date.getDate()} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}
