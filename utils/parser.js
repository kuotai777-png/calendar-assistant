export function parseSchedule(text) {
  let date = "今天";
  let time = "未指定";
  let title = text;

  if (text.includes("明天")) {
    date = "明天";
    title = title.replace("明天", "");
  }

  if (text.includes("後天")) {
    date = "後天";
    title = title.replace("後天", "");
  }

  if (text.includes("今天")) {
    date = "今天";
    title = title.replace("今天", "");
  }

  const afternoon = text.match(/下午(\d+)點/);

  if (afternoon) {
    const hour = Number(afternoon[1]) + 12;
    time = hour + ":00";
    title = title.replace(afternoon[0], "");
  }

  const morning = text.match(/上午(\d+)點/);

  if (morning) {
    time = morning[1] + ":00";
    title = title.replace(morning[0], "");
  }

  title = title.trim();

  if (!title) {
    title = "未命名行程";
  }

  return {
    date,
    time,
    title
  };
}
