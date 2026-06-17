// utils/parser.js
// AI Calendar Parser V1.7

export function parseSchedule(text) {

  try {

    let input = text.trim();

    let now = new Date();

    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();


    // ==========================
    // 日期解析
    // ==========================

    if (input.includes("明天")) {

      day += 1;
      input = input.replace("明天", "");

    }

    else if (input.includes("今天")) {

      input = input.replace("今天", "");

    }


    else {

      // 6/20 或 6月20日

      const dateMatch = input.match(
        /(\d{1,2})(\/|月)(\d{1,2})/
      );


      if(dateMatch){

        month = Number(dateMatch[1]) - 1;
        day = Number(dateMatch[3]);

        input = input.replace(
          dateMatch[0],
          ""
        );

      }

    }



    // ==========================
    // 時間解析
    // ==========================


    let hour = null;


    const timeMatch = input.match(
      /(上午|下午|晚上|早上)?\s*(\d{1,2})點/
    );


    if(!timeMatch){

      return null;

    }


    let period = timeMatch[1];
    hour = Number(timeMatch[2]);


    if(
      (period === "下午" ||
       period === "晚上") &&
       hour < 12
    ){

      hour += 12;

    }


    input = input.replace(
      timeMatch[0],
      ""
    );



    // ==========================
    // 標題
    // ==========================


    let title = input.trim();


    if(!title){

      title="未命名行程";

    }



    // ==========================
    // 建立時間
    // ==========================


    let start = new Date(
      year,
      month,
      day,
      hour,
      0,
      0
    );


    let end = new Date(
      start.getTime() + 60*60*1000
    );



    return {

      title:title,


      start:
      start.toISOString(),


      end:
      end.toISOString()

    };



  }catch(e){

    console.log(e);

    return null;

  }

}
