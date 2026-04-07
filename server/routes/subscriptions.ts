import { Router } from "express";

export const subscriptionsRouter = Router();

// In-memory store — defaults all to true except decline_rate (coming soon)
let subscriptions: Record<string, boolean> = {
  batch_holds: true,
  payout_failures: true,
  credential_expiry: true,
  webhook_health: true,
  merchant_inactivity: true,
  decline_rate: false,
};

subscriptionsRouter.get("/", (_req, res) => {
  res.json(subscriptions);
});

subscriptionsRouter.put("/", (req, res) => {
  const body = req.body as Record<string, boolean>;
  for (const key of Object.keys(subscriptions)) {
    if (typeof body[key] === "boolean") {
      subscriptions[key] = body[key];
    }
  }
  res.json(subscriptions);
});
