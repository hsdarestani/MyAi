import { api } from '../proxy';
export default async function ConversationsPage(){ const data=await api('/api/admin/conversations'); return <main><h1>Conversations</h1><pre>{JSON.stringify(data,null,2)}</pre></main>; }
