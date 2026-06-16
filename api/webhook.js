import { messagingApi } from "@line/bot-sdk";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send(
      "Calendar Assistant Running"
    );
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
                "Calendar Assistant 已收到 👍\n\n" +
                event.message.text
            }
          ]
        });

      }
    }

    return res.status(200).json({
      status: "ok"
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
