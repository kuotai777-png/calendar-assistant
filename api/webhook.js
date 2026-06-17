import { parseSchedule } from "../utils/parser.js";

const LINE_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN;

const CALENDAR_API_URL =
  process.env.CALENDAR_API_URL;


export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }


  try {

    const body = req.body;
    const events = body.events || [];


    for (const event of events) {

      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;


      const userText =
        event.message.text.trim();


      console.log(
        "LINE 收到訊息:",
        userText
      );


      let replyText = "";


      // 查詢
      if (isQueryText(userText)) {

        replyText =
          await handleQuery(userText);

      }

      // 刪除
      else if (
        userText.startsWith("刪除")
      ) {

        replyText =
          await handleDelete(userText);

      }

      // 新增
      else {

        replyText =
          await handleAdd(userText);

      }


      await replyToLine(
        event.replyToken,
        replyText
      );

    }


    return res.status(200).json({
      ok:true
    });


  } catch(err){

    console.error(err);

    return res.status(200).json({
      ok:false,
      error:err.message
    });

  }

}


//====================
// 判斷查詢
//====================

function isQueryText(text){

 return (
   text.includes("查詢") ||
   text.includes("看行程")
 );

}


//====================
// 查詢
//====================

async function handleQuery(text){

 let target="today";


 if(text.includes("明天")){
   target="tomorrow";
 }


 if(
   text.includes("本週") ||
   text.includes("這週")
 ){
   target="week";
 }


 const calendar =
 await callCalendarApi({

   action:"query",
   target

 });


 return (
   calendar.message ||
   "查詢完成"
 );

}



//====================
// 刪除
//====================

async function handleDelete(text){


 const keyword =
 text.replace("刪除","")
     .trim();


 if(!keyword){

   return "請輸入要刪除的行程名稱";

 }


 const calendar =
 await callCalendarApi({

   action:"delete",
   keyword

 });


 return (
   calendar.message ||
   "刪除完成"
 );

}



//====================
// 新增
//====================

async function handleAdd(text){


 const parsed =
 parseSchedule(text);


 if(
   !parsed ||
   !parsed.start ||
   !parsed.end
 ){

   return "我看不懂這個行程時間，請試試：今天下午3點 開會";

 }


 const calendar =
 await callCalendarApi({

   action:"add",
   title:parsed.title,
   start:parsed.start,
   end:parsed.end

 });


 if(calendar.success===false){

   return (
     calendar.message ||
     "新增失敗"
   );

 }


 return (
 "已新增行程\n\n"+
 "事項："+parsed.title
 );

}



//====================
// 呼叫 Apps Script
//====================

async function callCalendarApi(payload){


 const response =
 await fetch(
   CALENDAR_API_URL,
   {
     method:"POST",
     headers:{
       "Content-Type":
       "application/json"
     },
     body:
     JSON.stringify(payload)
   }
 );


 const text =
 await response.text();


 try{

   return JSON.parse(text);

 }catch(e){

   return {
     success:false,
     message:
     "Apps Script 回傳格式錯誤"
   };

 }

}



//====================
// LINE 回覆
//====================

async function replyToLine(
 replyToken,
 text
){


 await fetch(
 "https://api.line.me/v2/bot/message/reply",
 {

 method:"POST",

 headers:{

 "Content-Type":
 "application/json",

 Authorization:
 "Bearer "+
 LINE_ACCESS_TOKEN

 },


 body:JSON.stringify({

 replyToken,

 messages:[
 {
 type:"text",
 text:text || "完成"
 }
 ]

 })

 }

 );


}
