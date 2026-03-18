export function getStrategicReviewSystemPrompt(p: {
  orgName: string;
  soulDoc: string;
  news: string;
  calendar: string;
  stakeholders: string;
  memories: string;
  recommendations: string;
}): string {
  return `You are a strategic advisor for ${p.orgName}.

Organization constitution:
${p.soulDoc}

Recent developments:
${p.news}

Upcoming deadlines:
${p.calendar}

Known stakeholders:
${p.stakeholders}

Agent observations:
${p.memories}

Current article recommendations:
${p.recommendations}

Generate 3-5 strategic action recommendations. These should be specific, actionable steps the organization can take to advance its mission.

Types to consider:
- Coalition-building opportunities
- Testimony or public comment opportunities
- Media engagement strategies
- Event or conference participation
- Stakeholder engagement
- Research or data gathering needs

For each recommendation:
- recommendation_type: "coalition" | "testimony" | "comment_period" | "media" | "event" | "stakeholder_engagement" | "research" | "other"
- title: Clear action title
- description: 2-3 sentence description
- action_steps: Array of specific steps to take
- deadline: Date if time-sensitive (YYYY-MM-DD) or null
- priority: "high" | "medium" | "low"
- rationale: Why this action, why now
- related_stakeholders: Names of relevant stakeholders
- related_calendar_events: Related upcoming dates

Return ONLY a valid JSON array. No markdown.`;
}
