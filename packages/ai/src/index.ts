export type TaskType='chat'|'image'|'video';
export type ProviderCost={amountToman:number;estimated?:boolean;usd?:number};
export interface AITextProvider { generateText(input:{prompt:string;model?:string;locale?:string}):Promise<any> };
export interface AIImageProvider { generateImage(input:{prompt:string;model?:string}):Promise<any> };
export interface AIVideoProvider { quoteVideo?(input:{prompt:string;model?:string}):Promise<any>; createVideoJob(input:{prompt:string;model?:string}):Promise<any>; getVideoJob(jobId:string,model?:string):Promise<any> };

type ChatProviderOptions={provider:string;baseUrl:string;apiKey?:string;model:string;estimatedCostToman?:number};
type VeniceModel={id:string;model?:string;name?:string;type?:string;traits?:string[];capabilities?:any;pricing?:any;[key:string]:any};
const VENICE_BASE='https://api.venice.ai/api/v1';
const NO_MODEL_FA='فعلاً مدل مناسب برای این کار پیدا نشد. چند دقیقه بعد دوباره امتحان کن.';
function isProd(){return process.env.NODE_ENV==='production'}
function mockAllowed(){return process.env.ALLOW_MOCK_AI==='true'&&!isProd()}
function usdToToman(){return Number(process.env.USD_TO_TOMAN||60000)}
function safeErr(txt:string){return txt.replace(/Bearer\s+[A-Za-z0-9._-]+/g,'Bearer [redacted]').replace(process.env.VENICE_API_KEY||'__none__','[redacted]').slice(0,1500)}
function fmt(tz:string){return new Intl.DateTimeFormat('fa-IR',{timeZone:tz,dateStyle:'full',timeStyle:'medium',hour12:false}).format(new Date())}
function isoDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'UTC'}).format(new Date())}
function systemPrompt(locale?:string){return `تو «اوستا» هستی؛ دستیار هوش مصنوعی فارسی‌اول. پیش‌فرض فارسی، ساده، دقیق و کاربردی جواب بده مگر کاربر زبان دیگری بخواهد. هرگز reasoning_content، زنجیره فکر، ابزارها یا متادیتای داخلی را افشا نکن. برای تاریخ و ساعت فقط از زمینه زیر استفاده کن و نگو دسترسی نداری.
امروز: ${isoDate()}
زمان سرور: ${fmt(process.env.APP_TIMEZONE||'UTC')}
ساعت آلمان: ${fmt('Europe/Berlin')}
ساعت تهران: ${fmt('Asia/Tehran')}
زبان/locale کاربر: ${locale||'fa-IR'}`}
function looks(m:VeniceModel,s:string){return JSON.stringify(m).toLowerCase().includes(s)}
function modelId(m:any){return String(m?.id||m?.model||m?.name||'')}
function normalizePrompt(prompt:string,task:TaskType){
  if(task!=='image'&&task!=='video')return prompt;
  let p=prompt.trim();
  if(/دختر جذاب|دختر خوشگل|sexy girl/i.test(p)) p='پرتره سینمایی از یک زن بزرگسال با استایل شیک، نورپردازی حرفه‌ای، فضای مد و فشن، غیر برهنه، بدون محتوای جنسی، کیفیت بالا';
  p+= '\nSafe generation: adult subjects only, no explicit sexual content, no minors, no real-person impersonation.';
  return p;
}

export class VeniceModelRegistry{
  private models:VeniceModel[]=[]; private traits:any=null; private last=0; private ttl=10*60*1000; private lastError:string|null=null;
  constructor(private apiKey=process.env.VENICE_API_KEY){}
  get lastRefresh(){return this.last?new Date(this.last).toISOString():null} get error(){return this.lastError}
  async refresh(){
    if(!this.apiKey) throw new Error('VENICE_API_KEY is not configured');
    const headers={Authorization:`Bearer ${this.apiKey}`};
    const [mr,tr]=await Promise.all([fetch(`${VENICE_BASE}/models`,{headers}),fetch(`${VENICE_BASE}/models/traits`,{headers}).catch(()=>null as any)]);
    const text=await mr.text(); if(!mr.ok){this.lastError=safeErr(`HTTP ${mr.status}: ${text}`); throw new Error(this.lastError)}
    const data=JSON.parse(text||'{}'); this.models=Array.isArray(data)?data:Array.isArray(data.data)?data.data:Array.isArray(data.models)?data.models:[];
    if(tr?.ok){this.traits=await tr.json().catch(()=>null)}
    this.last=Date.now(); this.lastError=null; return this.models;
  }
  async getModels(force=false){if(force||!this.last||Date.now()-this.last>this.ttl) await this.refresh(); return this.models}
  async select(task:TaskType,opts?:{model?:string;quality?:'fast'|'standard'|'high'}){
    if(opts?.model&&opts.model!=='auto'){
      if(task==='image'&&/^zai-org-glm/i.test(opts.model)) return process.env.VENICE_IMAGE_MODEL||'z-image-turbo';
      if(task==='video'&&/^zai-org-glm/i.test(opts.model)) return process.env.VENICE_VIDEO_MODEL||'auto';
      return opts.model;
    }
    const envModel=task==='chat'?process.env.VENICE_TEXT_MODEL:task==='image'?process.env.VENICE_IMAGE_MODEL:process.env.VENICE_VIDEO_MODEL;
    if(envModel)return envModel;
    let models:VeniceModel[]=[]; try{models=await this.getModels()}catch{
      if(task==='chat') return process.env.VENICE_TEXT_MODEL||'zai-org-glm-5-2';
      if(task==='image') return process.env.VENICE_IMAGE_MODEL||'z-image-turbo';
      return process.env.VENICE_VIDEO_MODEL||'auto';
    }
    const preferred=task==='image'?['qwen-image-2','qwen-image','venice-sd35','sd35']:task==='video'?['fast','standard','wan','ltx','hunyuan']:['default','fast','llama','qwen','glm'];
    let candidates=models.filter(m=>task==='chat'?looks(m,'chat')||looks(m,'text')||looks(m,'completion'):task==='image'?looks(m,'image')||looks(m,'text-to-image')||looks(m,'diffusion'):looks(m,'video')||looks(m,'text-to-video'));
    if(!candidates.length&&task==='chat') candidates=models;
    if(task==='video'&&opts?.quality!=='high') candidates=candidates.filter(m=>!/(pro|full|premium|ultra)/i.test(modelId(m))) || candidates;
    const chosen=preferred.map(p=>candidates.find(m=>modelId(m).toLowerCase().includes(p))).find(Boolean)||candidates[0];
    if(!chosen){ if(task==='chat') return process.env.VENICE_TEXT_MODEL||'zai-org-glm-5-2'; if(task==='image') return process.env.VENICE_IMAGE_MODEL||'z-image-turbo'; return process.env.VENICE_VIDEO_MODEL||'auto'; }
    return modelId(chosen);
  }
  status(){return {lastRefresh:this.lastRefresh,error:this.lastError,models:this.models.length,chat:this.peek('chat'),image:this.peek('image'),video:this.peek('video')}}
  private peek(task:TaskType){try{return this.models.find(m=>task==='chat'?looks(m,'chat')||looks(m,'text'):task==='image'?looks(m,'image'):looks(m,'video'))?.id||null}catch{return null}}
}
export const veniceModelRegistry=new VeniceModelRegistry();
export async function getVeniceModels(force=false){return veniceModelRegistry.getModels(force)}
export async function selectVeniceModel(taskType:TaskType,options?:{model?:string;quality?:'fast'|'standard'|'high'}){return veniceModelRegistry.select(taskType,options)}

export class MockProvider implements AITextProvider,AIImageProvider,AIVideoProvider{private ensureAllowed(){ if(!mockAllowed()) throw new Error('Mock AI is disabled. Configure Venice.'); } async generateText({prompt}:{prompt:string}){this.ensureAllowed();return {text:`پاسخ آزمایشی اوستا:\n${prompt}`,usage:{chars:prompt.length},providerCost:{amountToman:0,estimated:true},provider:'mock',model:'mock-chat'}} async generateImage({prompt}:{prompt:string}){this.ensureAllowed();return {imageUrl:`https://dummyimage.com/1024x1024/111/fff.png&text=${encodeURIComponent('Osta')}`,usage:{prompt},providerCost:{amountToman:0,estimated:true},provider:'mock',model:'mock-image'}} async createVideoJob({prompt}:{prompt:string}){this.ensureAllowed();return {jobId:`mock-${Date.now()}`,estimatedCost:{amountToman:0,estimated:true},provider:'mock',model:'mock-video',prompt}} async getVideoJob(jobId:string){this.ensureAllowed();return {status:'completed' as const,videoUrl:'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',providerCost:{amountToman:0,estimated:true},jobId}}}

export class OpenAICompatibleProvider implements AITextProvider,AIImageProvider,AIVideoProvider{protected opts:ChatProviderOptions; constructor(opts?:Partial<ChatProviderOptions>){this.opts={provider:opts?.provider||'openai-compatible',baseUrl:(opts?.baseUrl||process.env.OPENAI_COMPATIBLE_BASE_URL||'').replace(/\/$/,''),apiKey:opts?.apiKey||process.env.OPENAI_COMPATIBLE_API_KEY,model:opts?.model||process.env.OPENAI_COMPATIBLE_MODEL||'gpt-4o-mini',estimatedCostToman:opts?.estimatedCostToman??Number(process.env.PROVIDER_TEXT_ESTIMATE_TOMAN||250)}} get provider(){return this.opts.provider} get model(){return this.opts.model} protected endpoint(){return `${this.opts.baseUrl}/chat/completions`} protected validate(){ if(!this.opts.baseUrl) throw new Error(`${this.opts.provider} base URL is not configured`); if(!this.opts.apiKey) throw new Error(`${this.opts.provider} API key is not configured`); } async generateText({prompt,model,locale}:{prompt:string;model?:string;locale?:string}){this.validate();const payload:any={model:model||this.opts.model,messages:[{role:'system',content:systemPrompt(locale)},{role:'user',content:prompt}],temperature:0.7};const response=await fetch(this.endpoint(),{method:'POST',headers:{Authorization:`Bearer ${this.opts.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const raw=await response.text();const data:any=JSON.parse(raw||'{}');if(!response.ok) throw new Error(safeErr(`${this.opts.provider} request failed (${response.status}): ${raw}`));const content=data?.choices?.[0]?.message?.content;if(!content||typeof content!=='string') throw new Error(`${this.opts.provider} returned an empty response`);const usd=Number(data?.cost?.usd||0);return {text:content.trim(),usage:data?.usage||null,providerCost:{amountToman:usd?Math.ceil(usd*usdToToman()):this.opts.estimatedCostToman,estimated:!usd,usd:usd||undefined},provider:this.opts.provider,model:payload.model}} async generateImage(){throw new Error(NO_MODEL_FA)} async createVideoJob(){throw new Error(NO_MODEL_FA)} async getVideoJob(){throw new Error(NO_MODEL_FA)}};

export class VeniceProvider extends OpenAICompatibleProvider{constructor(model?:string){super({provider:'venice',baseUrl:VENICE_BASE,apiKey:process.env.VENICE_API_KEY,model:model||process.env.VENICE_TEXT_MODEL||'auto',estimatedCostToman:Number(process.env.VENICE_TEXT_ESTIMATE_TOMAN||250)})} protected validate(){if(!this.opts.apiKey) throw new Error('VENICE_API_KEY is not configured')} async generateText(input:{prompt:string;model?:string;locale?:string}){const model=input.model||await selectVeniceModel('chat',{model:this.opts.model});return super.generateText({...input,model})} async generateImage({prompt,model}:{prompt:string;model?:string}){this.validate();const selected=model||await selectVeniceModel('image');const body:any={model:selected,prompt:normalizePrompt(prompt,'image'),aspect_ratio:'1:1',resolution:'1K',width:1024,height:1024};const res=await fetch(`${VENICE_BASE}/image/generate`,{method:'POST',headers:{Authorization:`Bearer ${this.opts.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await res.text();const data:any=JSON.parse(raw||'{}');if(!res.ok) throw new Error(safeErr(`Venice image failed (${res.status}): ${raw}`));const first=data?.images?.[0];const rawFirst=typeof first==='string'?first:null;const url=(typeof first==='object'?first?.url:null)||data?.data?.[0]?.url||data?.image_url||data?.url;const b64=rawFirst||(typeof first==='object'?first?.b64_json:null)||data?.data?.[0]?.b64_json||data?.b64_json||data?.image; if(!url&&!b64) throw new Error(`Image response contained no image. keys=${Object.keys(data||{}).join(',')}`);const usd=Number(data?.cost?.usd||0);const imageUrl=url||(String(b64).startsWith('data:')||String(b64).startsWith('http')?String(b64):`data:image/png;base64,${b64}`);return {imageUrl,usage:data?.usage||data,providerCost:{amountToman:usd?Math.ceil(usd*usdToToman()):Number(process.env.VENICE_IMAGE_ESTIMATE_TOMAN||2500),estimated:!usd,usd:usd||undefined},provider:'venice',model:selected}} async quoteVideo({prompt,model}:{prompt:string;model?:string}){this.validate();const selected=model||await selectVeniceModel('video');const body={model:selected,prompt:normalizePrompt(prompt,'video')};const res=await fetch(`${VENICE_BASE}/video/quote`,{method:'POST',headers:{Authorization:`Bearer ${this.opts.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await res.text();if(!res.ok) return {model:selected,providerCost:{amountToman:Number(process.env.VENICE_VIDEO_ESTIMATE_TOMAN||15000),estimated:true},error:safeErr(raw)};const data:any=JSON.parse(raw||'{}');const usd=Number(data?.cost?.usd||data?.quote?.usd||0);return {model:selected,providerCost:{amountToman:usd?Math.ceil(usd*usdToToman()):Number(process.env.VENICE_VIDEO_ESTIMATE_TOMAN||15000),estimated:!usd,usd:usd||undefined},raw:data}} async createVideoJob({prompt,model}:{prompt:string;model?:string}){this.validate();const selected=model||await selectVeniceModel('video');const body={model:selected,prompt:normalizePrompt(prompt,'video')};const res=await fetch(`${VENICE_BASE}/video/queue`,{method:'POST',headers:{Authorization:`Bearer ${this.opts.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await res.text();const data:any=JSON.parse(raw||'{}');if(!res.ok) throw new Error(safeErr(`Venice video queue failed (${res.status}): ${raw}`));const jobId=data?.queue_id||data?.id||data?.job_id;if(!jobId) throw new Error('Venice video queue returned no queue_id');return {jobId,provider:'venice',model:selected,prompt,raw:data}} async getVideoJob(jobId:string,model?:string){this.validate();const res=await fetch(`${VENICE_BASE}/video/retrieve`,{method:'POST',headers:{Authorization:`Bearer ${this.opts.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({queue_id:jobId,model})});const raw=await res.text();const data:any=JSON.parse(raw||'{}');if(!res.ok) throw new Error(safeErr(`Venice video retrieve failed (${res.status}): ${raw}`));const status=String(data?.status||'processing').toLowerCase();return {status:status.includes('complete')||data?.url?'completed':status.includes('fail')?'failed':'processing',videoUrl:data?.url||data?.video_url||data?.result_url,providerCost:{amountToman:Number(process.env.VENICE_VIDEO_ESTIMATE_TOMAN||15000),estimated:true},jobId,raw:data}}}
export type ProviderMode='mock'|'venice'|'openai-compatible'|'auto';
export function getAIProvider(mode:ProviderMode|string=process.env.AI_PROVIDER_MODE||'venice',model?:string){if(mode==='auto'||mode==='venice') return new VeniceProvider(model); if(mode==='openai-compatible') return new OpenAICompatibleProvider({model}); if(mode==='mock') return new MockProvider(); throw new Error(`Unsupported AI provider: ${mode}`)}
export const friendlyNoModelMessage=NO_MODEL_FA;
