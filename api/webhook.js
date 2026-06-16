import { messagingApi } from "@line/bot-sdk";
import { parseSchedule } from "../utils/parser.js";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});


export default async function handler(req, res) {

  if (req.method !== "POST") {
    res.status(200).send("Calendar Assistant Running");
    return;
  }


  try {

    const events = req.body.events || [];


    for (const event of events) {

      if (
        event.type === "message" &&
        event.message.type === "text"
      ) {

        const result =
          parseSchedule(
            event.message.text
          );


        const response =
          await fetch(
            process.env.CALENDAR_API_URL,
            {
              method: "POST",
              body: JSON.stringify({
                title: result.title,
                start:
                  new Date().toISOString()
              })
            }
          );


        const calendarResult =
          await response.json();


        let reply = "";


        if (
          calendarResult.status ===
          "conflict"
        ) {

          reply =
            "時間衝突\n\n" +
            "已有：" +
            calendarResult.event;

        } else {

          reply =
            "已新增行程\n\n" +
            "日期：" +
            result.date +
            "\n時間：" +
            result.time +
            "\n事項：" +
            result.title;

        }


        await client.replyMessage({
          replyToken:
            event.replyToken,

          messages: [
            {
              type: "text",
              text: reply
            }
          ]
        });

      }

    }


    res.status(200).json({
      status: "ok"
    });


  } catch (error) {

    console.log(error);

    res.status(500).json({
      error:
        error.message
    });

  }

}
