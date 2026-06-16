import { messagingApi } from "@line/bot-sdk";
import { parseSchedule } from "../utils/parser.js";


const client =
  new messagingApi.MessagingApiClient({

    channelAccessToken:
      process.env.LINE_CHANNEL_ACCESS_TOKEN

  });



export default async function handler(req,res){


  if(req.method !== "POST"){

    res.status(200)
       .send(
        "Calendar Assistant Running"
       );

    return;

  }



  try{


    const events =
      req.body.events || [];



    for(
      const event of events
    ){


      if(
        event.type === "message"
        &&
        event.message.type === "text"
      ){


        const text =
          event.message.text;


        const result =
          parseSchedule(text);



        let reply = "";



        // ===================
        // 查詢模式
        // ===================


        if(
          text.includes("行程")
          &&
          (
            text.includes("今天")
            ||
            text.includes("明天")
            ||
            text.includes("後天")
          )
        ){


          const response =
            await fetch(

              process.env.CALENDAR_API_URL,

              {

                method:"POST",

                body:
                  JSON.stringify({

                    action:"list",

                    start:
                      result.start

                  })

              }

            );


          const data =
            await response.json();



          if(
            data.events.length === 0
          ){

            reply =
              "沒有行程";

          }else{


            reply =
              "行程列表\n\n";


            data.events.forEach(
              item=>{

                reply +=

                  item.no +
                  ". " +
                  item.time +
                  " " +
                  item.title +
                  "\n";

              }
            );


          }



        }


        // ===================
        // 新增模式
        // ===================

        else{


          const response =
            await fetch(

              process.env.CALENDAR_API_URL,

              {

                method:"POST",

                body:
                  JSON.stringify({

                    title:
                      result.title,

                    start:
                      result.start

                  })

              }

            );


          const calendar =
            await response.json();



          if(
            calendar.status
            ===
            "conflict"
          ){


           reply =
  calendar.message;


          }else{


            reply =
              "已新增行程\n\n"+
              "日期：" +
              result.date +
              "\n時間：" +
              result.time +
              "\n事項：" +
              result.title;


          }


        }



        await client.replyMessage({

          replyToken:
            event.replyToken,

          messages:[
            {
              type:"text",
              text:reply
            }
          ]

        });


      }


    }



    res.status(200)
       .json({
          status:"ok"
       });



  }catch(error){


    console.log(error);


    res.status(500)
       .json({

        error:
          error.message

       });


  }


}
