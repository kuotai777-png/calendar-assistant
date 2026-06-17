import { Client } from "@line/bot-sdk";
import { parseSchedule } from "../utils/parser.js";

const client = new Client({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

const CALENDAR_API = process.env.CALENDAR_API_URL;


// ==========================
// 主入口
// ==========================
export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("AI Calendar Bot V1.6");
  }

  try {

    const event = req.body.events?.[0];

    if (!event || event.type !== "message") {
      return res.status(200).end();
    }


    const userText = event.message.text.trim();

    console.log("收到:", userText);


    let replyText = "";


    // ==========================
    // ① 查詢行程優先
    // ==========================

    if (
      userText.includes("今天行程") ||
      userText.includes("查今天")
    ) {

      replyText = await queryCalendar("today");

    }


    else if (
      userText.includes("明天行程") ||
      userText.includes("查明天")
    ) {

      replyText = await queryCalendar("tomorrow");

    }


    else if (
      userText.includes("本週行程") ||
      userText.includes("這週行程")
    ) {

      replyText = await queryCalendar("week");

    }



    // ==========================
    // ② 新增行程
    // ==========================

    else {

      const data = parseSchedule(userText);


      if (!data) {

        replyText =
`我還無法判斷時間

你可以輸入：

今天下午3點 開會
明天上午10點 看醫生

或：

今天行程
明天行程`;

      }


      else {


        const result = await fetch(
          CALENDAR_API,
          {
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },

            body:JSON.stringify({
              action:"add",
              title:data.title,
              start:data.start,
              end:data.end
            })

          }
        );


        const json = await result.json();


        if(json.ok){

          replyText =
`✅ 已加入行程

${data.title}

${data.start}`;

        }else{

          replyText="Google Calendar 新增失敗";

        }

      }

    }



    // ==========================
    // LINE 回覆
    // ==========================

    await client.replyMessage(
      event.replyToken,
      {
        type:"text",
        text:replyText
      }
    );


    return res.status(200).end();



  } catch(err){

    console.error(err);

    return res.status(200).end();

  }

}



// ==========================
// 查詢 Google Calendar
// ==========================

async function queryCalendar(type){


  try{


    const result = await fetch(
      CALENDAR_API,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({
          action:"query",
          range:type
        })

      }
    );


    const json = await result.json();



    if(!json.events || json.events.length===0){

      return "目前沒有行程";

    }


    let text="📅 行程如下\n\n";


    json.events.forEach(e=>{

      text +=
`${e.time}
${e.title}

`;

    });


    return text;



  }catch(e){

    console.log(e);

    return "讀取行程失敗";

  }


}
