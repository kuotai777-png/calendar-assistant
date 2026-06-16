export function parseSchedule(text) {

  let title = text;
  let hour = 9;
  let dayOffset = 0;


  // 判斷日期

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


  // 判斷時間

  const timeMatch =
    text.match(
      /(上午|早上|下午|晚上)(\d+)點/
    );


  if (timeMatch) {

    hour =
      Number(timeMatch[2]);


    if (
      (
        timeMatch[1] === "下午" ||
        timeMatch[1] === "晚上"
      )
      &&
      hour < 12
    ) {

      hour += 12;

    }


    title =
      title.replace(
        timeMatch[0],
        ""
      );

  }


  // 建立日期物件

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


  // 顯示日期

  const dateText =
    start.getFullYear()
    +
    "/" +
    String(
      start.getMonth()+1
    ).padStart(2,"0")
    +
    "/" +
    String(
      start.getDate()
    ).padStart(2,"0");


  // 顯示時間

  const timeText =
    String(hour)
      .padStart(2,"0")
    +
    ":00";


  // 給 Google Calendar 的時間
  // 固定台灣時區 +08:00

  const calendarTime =
    start.getFullYear()
    +
    "-" +
    String(
      start.getMonth()+1
    ).padStart(2,"0")
    +
    "-" +
    String(
      start.getDate()
    ).padStart(2,"0")
    +
    "T" +
    String(hour)
      .padStart(2,"0")
    +
    ":00:00+08:00";


  return {

    title:
      title.trim(),

    date:
      dateText,

    time:
      timeText,

    start:
      calendarTime

  };

}
