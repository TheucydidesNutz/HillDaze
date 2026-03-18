// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMonthlyReportPrompt(orgName: string, data: any): { system: string; user: string } {
  return {
    system: `You are a report writer for ${orgName}. Generate a comprehensive monthly intelligence summary. Write in professional, clear prose. Use markdown formatting. Be specific — cite names, dates, bills, and sources where available.`,
    user: `Generate a Monthly Intelligence Summary covering ${data.period.start} to ${data.period.end}.

Data for this period:
- ${data.conversationCount} conversations conducted
- ${data.documents.length} documents uploaded
- ${data.topNews.length} relevant news items tracked
- ${data.recommendations.length} article recommendations generated
- ${data.trends.length} trend reports produced
- ${data.strategicRecs.length} strategic recommendations
- ${data.focusProposals.length} focus area proposals
- ${data.soulDocVersions.length} soul document revisions
- ${data.calendarEvents.length} upcoming events

Top news items:
${data.topNews.map((n: { title: string; source_type: string; summary: string }) => `- [${n.source_type}] ${n.title}: ${(n.summary || '').substring(0, 150)}`).join('\n')}

Trend reports:
${data.trends.map((t: { title: string; summary: string }) => `- ${t.title}: ${t.summary}`).join('\n') || 'None generated.'}

Article recommendations:
${data.recommendations.map((r: { title: string; thesis: string; status: string }) => `- ${r.title} (${r.status}): ${r.thesis}`).join('\n') || 'None generated.'}

Strategic recommendations:
${data.strategicRecs.map((r: { title: string; priority: string; status: string }) => `- [${r.priority}] ${r.title} (${r.status})`).join('\n') || 'None generated.'}

Focus proposals:
${data.focusProposals.map((p: { proposal_type: string; description: string; status: string }) => `- [${p.proposal_type}] ${p.description} → ${p.status}`).join('\n') || 'None.'}

Agent observations:
${data.memories.map((m: { subject: string; content: string }) => `- ${m.subject}: ${m.content}`).join('\n') || 'None.'}

Research targets:
${data.researchTargets.map((t: { name: string; description: string }) => `- ${t.name}: ${t.description}`).join('\n') || 'None.'}

Looking ahead — upcoming events:
${data.calendarEvents.map((e: { title: string; event_date: string; event_type: string }) => `- ${e.event_date}: ${e.title} (${e.event_type})`).join('\n') || 'No upcoming events.'}

Key stakeholders:
${data.stakeholders.slice(0, 10).map((s: { name: string; organization: string; mention_count: number }) => `- ${s.name} (${s.organization || 'N/A'}) — ${s.mention_count} mentions`).join('\n') || 'None tracked.'}

Structure the report with these sections:
# Monthly Intelligence Summary — ${orgName}
## Executive Summary
## Key Developments
## Policy & Regulatory Watch
## Strategic Actions
## Article Pipeline
## Research Updates
## Looking Ahead
## Stakeholder Watch
## Recommendations for Next Month`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExecutiveBriefPrompt(orgName: string, data: any): { system: string; user: string } {
  return {
    system: `You are writing a concise 1-2 page executive briefing for ${orgName}'s board. Be direct, highlight only the most important items. Use bullet points.`,
    user: `Generate a 1-2 page executive briefing for ${data.period.start} to ${data.period.end}.

Key data: ${data.conversationCount} conversations, ${data.topNews.length} news items, ${data.trends.length} trends, ${data.strategicRecs.length} strategic recs.

Top 5 news: ${data.topNews.slice(0, 5).map((n: { title: string }) => n.title).join('; ')}
Top trends: ${data.trends.map((t: { title: string }) => t.title).join('; ') || 'None'}
Urgent actions: ${data.strategicRecs.filter((r: { priority: string }) => r.priority === 'high').map((r: { title: string }) => r.title).join('; ') || 'None'}
Upcoming: ${data.calendarEvents.slice(0, 5).map((e: { title: string; event_date: string }) => `${e.event_date}: ${e.title}`).join('; ') || 'None'}

Format:
# Executive Briefing — ${orgName}
## Headlines (3-5 bullet points)
## Action Items (numbered)
## Looking Ahead`,
  };
}
