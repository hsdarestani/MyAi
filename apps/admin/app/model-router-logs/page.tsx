import { api } from '../proxy';
export default async function ModelRouterLogsPage(){ const data=await api('/api/admin/model-router-logs'); return <main><h1>Model Router Logs</h1><pre>{JSON.stringify(data,null,2)}</pre></main>; }
