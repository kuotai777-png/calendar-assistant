// utils/parser.js
// AI Calendar Parser V1.8

export function parseSchedule(text) {
  try {
    let input = text.trim();

    let now = new Date();

    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (input.includes("明天")) {
      day += 1;
      input = input.replace("明天", "");
    }

    else if (input.includes("今天")) {
      input = input.replace("今天", "");
    }

    else {
      const dateMatch = input.match(/(\d{1,2})(\/|月)(\d{1,2})(日)?/);

      if (dateMatch) {
        month = Number(dateMatch[1]) - 1;
        day = Number(dateMatch[3]);
        input = input.replace(dateMatch[0], "");
      }
    }

    const timeMatch = input.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})點/);

    if (!timeMatch) {
      return null;
    }

    let period = timeMatch[1] || "";
    let hour = Number(timeMatch[2]);

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

    let start = new Date(year, month, day, hour, 0, 0);
    let end = new Date(start.getTime() + 60 * 60 * 1000);

    return {
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      displayTime: formatDisplay(start),
    };

  } catch (e) {
    console.log(e);
    return null;
  }
}

export function parseDelete(text) {
  let input = text.trim();

  input = input.replace("刪除", "").replace("删除", "").trim();

  let range = "week";

  if (input.includes("今天")) {
    range = "today";
    input = input.replace("今天", "").trim();
  }

  else if (input.includes("明天")) {
    range = "tomorrow";
    input = input.replace("明天", "").trim();
  }

  else if (input.includes("本週") || input.includes("這週") || input.includes("本周")) {
    range = "week";
    input = input.replace("本週", "").replace("這週", "").replace("本周", "").trim();
  }

  return {
    range,
    keyword: input,
  };
}

function formatDisplay(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}
