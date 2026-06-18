import { parseSchedule, parseDelete } from "../utils/parser.js";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  try {

    const event = req.body.events?.[0];

    if (!event || event.type !== "message") {
      return res.status(200).end();
    }


    const text =
      event.message.text.trim();

    const replyToken =
      event.replyToken;



    // ======================
    // 刪除行程
    // ======================

    if (
      text.startsWith("刪除") ||
      text.startsWith("删除")
    ) {

      const del =
        parseDelete(text);


      const r =
        await fetch(
          process.env.CALENDAR_API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                action:"delete",

                keyword:
                  del.keyword,

                range:
                  del.range,

                date:
                  del.date,

                time:
                  del.time

              })
          }
        );


      const result =
        await r.json();


      await reply(
        replyToken,
        result.message || "刪除完成"
      );


      return res
        .status(200)
        .end();

    }



    // ======================
    // 查詢行程
    // ======================

    if (
      text.includes("行程") ||
      text.includes("查詢")
    ) {


      const r =
        await fetch(
          process.env.CALENDAR_API_URL,
          {
            method:"POST",

            headers:{
              "Content-Type":
              "application/json"
            },

            body:
              JSON.stringify({
                action:"query",
                text
              })

          }
        );


      const result =
        await r.json();


      await reply(
        replyToken,
        result.message
      );


      return res
        .status(200)
        .end();

    }



    // ======================
    // 新增行程
    // ======================

    const schedule =
      parseSchedule(text);


    if (!schedule) {

      await reply(
        replyToken,
        "我看不懂這個行程時間，請試試：\n明天下午3點 開會"
      );

      return res
        .status(200)
        .end();

    }



    const r =
      await fetch(
        process.env.CALENDAR_API_URL,
        {

          method:"POST",

          headers:{
            "Content-Type":
            "application/json"
          },

          body:
            JSON.stringify({

              action:"add",

              ...schedule

            })

        }
      );


    const result =
      await r.json();


    await reply(
      replyToken,
      result.message ||
      "新增完成"
    );


    return res
      .status(200)
      .end();


  }

  catch(e){

    console.log(e);

    return res
      .status(200)
      .end();

  }

}



// ======================
// LINE reply
// ======================


async function reply(token,text){

  await fetch(
    "https://api.line.me/v2/bot/message/reply",
    {

      method:"POST",

      headers:{

        "Content-Type":
          "application/json",

        Authorization:
          "Bearer " +
          process.env.LINE_CHANNEL_ACCESS_TOKEN

      },


      body:
        JSON.stringify({

          replyToken:
            token,

          messages:[
            {
              type:"text",
              text
            }
          ]

        })

    }
  );

}
