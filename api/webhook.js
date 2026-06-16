import { messagingApi } from "@line/bot-sdk";

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

        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text:
                "Calendar Assistant OK\n" +
                event.message.text
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
      error: error.message
    });

  }
}
