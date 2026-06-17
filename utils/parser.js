export function parseSchedule(text) {
  const now = new Date();

  let date = new Date(now);

  if (text.includes("明天")) {
    date.setDate(date.getDate() + 1);
  }

  let hour = null;
  let minute = 0;

  const timeMatch = text.match(/(上午|下午|晚上|早上)?\s*(\d{1,2})\s*[點:：]\s*(\d{1,2})?/);

  if (!timeMatch) {
    return null;
  }

  const period = timeMatch[1] || "";
  hour = parseInt(timeMatch[2], 10);

  if (timeMatch[3]) {
    minute = parseInt(timeMatch[3], 10);
  }

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

  let title = text
    .replace("今天", "")
    .replace("明天", "")
    .replace(timeMatch[0], "")
    .trim();

  if (!title) {
    title = "未命名行程";
  }

  return {
    title,
    start: start.toISOString(),
    end: end.toISOString()
  };
}
