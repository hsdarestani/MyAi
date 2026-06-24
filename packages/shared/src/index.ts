export const formatToman = (n:number) => new Intl.NumberFormat('fa-IR').format(n);
export const taskLabel = (t:string) => t==='chat'?'چت با AI':t==='image'?'ساخت عکس':'ساخت ویدیو';
export const promptPreview = (s:string) => s.replace(/\s+/g,' ').slice(0,180);
