import { api } from '../proxy';
export default async function SafetyPage(){ const data=await api('/api/admin/settings'); return <main><h1>Safety settings</h1><p>Forbidden categories are hardcoded and non-removable.</p><pre>{JSON.stringify(data.defaults,null,2)}</pre></main>; }
