import { Router } from "express";
import { LinearClient } from "@linear/sdk";

export const linearRouter = Router();

function getClient(): LinearClient | null {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return null;
  return new LinearClient({ apiKey });
}

// ── Check if Linear is configured + list teams ─────────────────────────

linearRouter.get("/config", async (_req, res) => {
  const client = getClient();
  if (!client) {
    return res.json({ configured: false, teams: [] });
  }

  try {
    const teamsResult = await client.teams();
    const teams = teamsResult.nodes.map((t) => ({
      id: t.id,
      name: t.name,
      key: t.key,
    }));
    res.json({ configured: true, teams });
  } catch (err: any) {
    console.error("Linear config check failed:", err.message);
    res.status(500).json({ error: "Failed to connect to Linear", detail: err.message });
  }
});

// ── Create a Linear issue ──────────────────────────────────────────────

linearRouter.post("/issues", async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.status(400).json({ error: "Linear is not configured. Set LINEAR_API_KEY in .env." });
  }

  const { teamId, title, body, priority, groupId } = req.body;

  if (!teamId || !title) {
    return res.status(400).json({ error: "teamId and title are required." });
  }

  // Map priority string to Linear's 0-4 scale:
  // 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
  const priorityMap: Record<string, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  try {
    // Find the Draft (or Backlog) state to create as draft
    const team = await client.team(teamId);
    const states = await team.states();
    const draftState = states.nodes.find((s) => s.name.toLowerCase() === "draft")
      || states.nodes.find((s) => s.name.toLowerCase() === "triage")
      || states.nodes.find((s) => s.type === "backlog");

    const issue = await client.createIssue({
      teamId,
      title,
      description: body || "",
      priority: priorityMap[priority] ?? 3,
      ...(draftState ? { stateId: draftState.id } : {}),
    });

    const created = await issue.issue;
    if (!created) {
      return res.status(500).json({ error: "Issue creation returned no result." });
    }

    res.json({
      id: created.id,
      identifier: created.identifier,
      title: created.title,
      url: created.url,
      groupId,
    });
  } catch (err: any) {
    console.error("Linear issue creation failed:", err.message);
    res.status(500).json({ error: "Failed to create Linear issue", detail: err.message });
  }
});
