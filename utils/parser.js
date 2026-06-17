export function parseSchedule(text) {
  const now = new Date();
  let date = new Date(now);

  // 今天 / 明天
  if (text.includes("明天")) {
    date.setDate(date.getDate() + 1);
  }

  // 指定日期：6月25日 / 6月25
  const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日?/);

  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10) - 1;
    const day = parseInt(dateMatch[2], 10);

    date.setMonth(month);
    date.setDate(day);
  }

  // 星期 / 下週
  const weekMap = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "日": 0,
    "天": 0
  };

  const weekMatch = text.match(/(下週|下星期|星期|週)([一二三四五六日天])/);

  if (weekMatch) {
    const targetDay = weekMap[weekMatch[2]];
    const today = date.getDay();

    let diff = targetDay - today;

    if (diff <= 0) {
      diff += 7;
    }

    if (
      weekMatch[1] === "下週" ||
      weekMatch[1] === "下星期"
    ) {
      diff += 7;
    }

    date.setDate(date.getDate() + diff);
  }

  // 月底
  if (text.includes("月底")) {
    date = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    );
  }

  // 時間解析
  const timeMatch = text.match(
    /(上午|下午|晚上|早上)?\s*(\d{1,2})\s*[點:：]\s*(\d{1,2})?/
  );

  if (!timeMatch) {
    return null;
  }

  const period = timeMatch[1] || "";
  let hour = parseInt(timeMatch[2], 10);
  const minute = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  if ((period === "下午" || period === "晚上") && hour < 12) {
    hour += 12;
  }

  if ((period === "上午" || period === "早上") && hour === 12) {
    hour = 0;
  }

  date.setHours(hour, minute, 0, 0);

  const start = new Date(date);
  const end = new Date(date);
  end.setHours(end.getHours() + 1);

  // 標題
  let title = text
    .replace("今天", "")
    .replace("明天", "")
    .replace("下週", "")
    .replace("下星期", "")
    .replace("星期", "")
    .replace("週", "")
    .replace("月底", "")
    .replace(dateMatch?.[0] || "", "")
    .replace(timeMatch[0], "")
    .trim();

  if (!title) {
    title = "未命名行程";
  }

  return {
    title,
    start: formatLocalDateTime(start),
    end: formatLocalDateTime(end)
  };
}

function formatLocalDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d}T${h}:${min}:00`;
}
