import { api } from '../proxy';
export default async function ModelsPage(){ const data=await api('/api/admin/models'); return <main><h1>Model Registry</h1><pre>{JSON.stringify(data,null,2)}</pre></main>; }
