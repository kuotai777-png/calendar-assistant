export function parseSchedule(text) {

  let title = text;
  let hour = 9;
  let dayOffset = 0;


  // 日期判斷

  if (text.includes("明天")) {
    dayOffset = 1;
    title = title.replace("明天", "");
  }

  if (text.includes("後天")) {
    dayOffset = 2;
    title = title.replace("後天", "");
  }

  if (text.includes("今天")) {
    dayOffset = 0;
    title = title.replace("今天", "");
  }


  // 時間判斷

  const match =
    text.match(
      /(上午|早上|下午|晚上)(\d+)點/
    );


  if (match) {

    hour =
      Number(match[2]);


    if (
      (match[1] === "下午" ||
       match[1] === "晚上")
       &&
       hour < 12
    ) {

      hour += 12;

    }


    title =
      title.replace(
        match[0],
        ""
      );

  }


  // 建立真正日期

  const start =
    new Date();


  start.setDate(
    start.getDate()
    +
    dayOffset
  );


  start.setHours(
    hour,
    0,
    0,
    0
  );


  const dateText =
    start.getFullYear()
    +
    "/" +
    (start.getMonth()+1)
    +
    "/" +
    start.getDate();


  const timeText =
    String(hour)
      .padStart(2,"0")
    +
    ":00";


  return {

    title:
      title.trim(),

    date:
      dateText,

    time:
      timeText,

    start:
      start.toISOString()

  };

}
