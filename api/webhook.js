import { parseSchedule } from "../utils/parser.js";

const LINE_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN;

const CALENDAR_API_URL =
  process.env.CALENDAR_API_URL;


//=====================
// 主入口
//=====================

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }


  try {

    const events =
      req.body.events || [];


    for (const event of events) {

      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;


      const text =
        event.message.text.trim();


      console.log(
        "LINE 收到:",
        text
      );


      let reply;


      //查詢
      if (isQuery(text)) {

        reply =
          await query(text);

      }

      //刪除
      else if (
        text.startsWith("刪除")
      ) {

        reply =
          await remove(text);

      }

      //修改
      else if (
        text.startsWith("把") &&
        text.includes("改成")
      ) {

        reply =
          await update(text);

      }


      //新增
      else {

        reply =
          await add(text);

      }


      await replyLine(
        event.replyToken,
        reply
      );

    }


    return res.status(200).json({
      ok:true
    });


  }catch(e){

    console.error(e);

    return res.status(200).json({
      error:e.message
    });

  }

}


//=====================
// 查詢判斷
//=====================

function isQuery(text){

 return (
  text.includes("查詢") ||
  text.includes("看行程")
 );

}


//=====================
// 查詢
//=====================

async function query(text){

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


 const r =
 await api({

 action:"query",
 target

 });


 return r.message;

}



//=====================
// 新增
//=====================

async function add(text){

 const p =
 parseSchedule(text);


 if(!p){

 return "無法辨識時間";

 }


 const r =
 await api({

 action:"add",
 title:p.title,
 start:p.start,
 end:p.end

 });


 return (
 r.message ||
 "已新增"
 );

}



//=====================
// 刪除
//=====================

async function remove(text){


 const keyword =
 text.replace("刪除","")
 .trim();


 const r =
 await api({

 action:"delete",
 keyword

 });


 return r.message;

}



//=====================
// 修改
//=====================

async function update(text){


 // 把開會改成下午4點

 const temp =
 text
 .replace("把","")
 .split("改成");


 const keyword =
 temp[0].trim();


 const newTime =
 temp[1].trim();



 const r =
 await api({

 action:"update",
 keyword,
 newTime

 });


 return r.message;

}



//=====================
// Apps Script API
//=====================

async function api(data){


 const res =
 await fetch(
 CALENDAR_API_URL,
 {

 method:"POST",

 headers:{
 "Content-Type":
 "application/json"
 },

 body:
 JSON.stringify(data)

 });


 return await res.json();

}



//=====================
// LINE 回覆
//=====================

async function replyLine(
 token,
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


 body:
 JSON.stringify({

 replyToken:token,

 messages:[
 {
 type:"text",
 text:
 text || "完成"
 }
 ]

 })

 }

 );


}
