import { Router } from "express";

export const slackRouter = Router();

slackRouter.post("/support", async (req, res) => {
  try {
    const { alertId, subject, message, method, phone } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      // If no webhook configured, log and return success (graceful degradation)
      console.log(`[Slack] No SLACK_WEBHOOK_URL configured. Support request logged:`, { alertId, subject, message, method });
      return res.json({
        success: true,
        delivered: false,
        message: "Support request logged. Slack webhook not configured."
      });
    }

    // Build Slack Block Kit message
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `🚨 Pulse Support Request`, emoji: true }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Subject:*\n${subject || "No subject"}` },
          { type: "mrkdwn", text: `*Method:*\n${method || "slack"}` },
        ]
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Message:*\n${message}` }
      }
    ];

    if (alertId) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `🔗 Linked to alert: \`${alertId}\`` }]
      });
    }

    if (phone) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `📞 Callback requested: ${phone}` }]
      });
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Slack] Webhook failed:", response.status, text);
      return res.status(502).json({ success: false, error: "Slack webhook delivery failed" });
    }

    res.json({ success: true, delivered: true });
  } catch (err: any) {
    console.error("[Slack] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
