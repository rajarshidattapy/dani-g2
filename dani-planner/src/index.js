import api, { route } from '@forge/api';

// Fetch recent issues from a Jira project so the agent can ground its plan
export const analyzeProject = async (payload) => {
  const projectKey = payload?.projectKey ?? payload?.context?.jira?.projectKey;
  const res = await api.asApp().requestJira(route`/rest/api/3/search?jql=project=${projectKey} ORDER BY created DESC&maxResults=50&fields=summary,status,issuetype,labels`);
  const data = await res.json();
  if (!data.issues) return { projectKey, issues: [], error: data.errorMessages ?? 'no issues' };
  return {
    projectKey,
    issues: data.issues.map(i => ({
      key: i.key,
      summary: i.fields.summary,
      type: i.fields.issuetype?.name,
      status: i.fields.status?.name,
      labels: i.fields.labels ?? []
    }))
  };
};

// Create the approved plan (epics + stories) in Jira
export const createPlan = async (payload) => {
  const projectKey = payload?.projectKey ?? payload?.context?.jira?.projectKey;
  const plan = JSON.parse(payload.plan);
  const created = [];
  for (const epic of plan.epics ?? []) {
    const epicRes = await api.asApp().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: epic.title,
          description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: epic.summary ?? epic.title }] }] },
          issuetype: { name: 'Epic' }
        }
      })
    });
    const epicData = await epicRes.json();
    const epicKey = epicData.key;
    const stories = [];
    for (const story of epic.stories ?? []) {
      const ac = (story.acceptanceCriteria ?? []).map(c => `- ${c}`).join('\n');
      const storyRes = await api.asApp().requestJira(route`/rest/api/3/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: story.title,
            description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: `Acceptance criteria:\n${ac}` }] }] },
            issuetype: { name: 'Story' },
            parent: epicKey ? { key: epicKey } : undefined
          }
        })
      });
      const storyData = await storyRes.json();
      if (storyData.key) stories.push(storyData.key);
    }
    created.push({ epic: epicKey ?? null, stories });
  }
  return { projectKey, created };
};
