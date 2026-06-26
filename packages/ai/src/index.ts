export type TaskType='chat'|'image'|'video';
export type ProviderCost={amountToman:number;estimated?:boolean;usd?:number};
export interface AITextProvider { generateText(input:{prompt:string;model?:string;locale?:string}):Promise<any> };
export interface AIImageProvider { generateImage(input?:any):Promise<any> };
export interface AIVideoProvider { quoteVideo?(input?:any):Promise<any>; createVideoJob(input?:any):Promise<any>; getVideoJob(jobId?:string,model?:string):Promise<any> };

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

export type SmartTaskType = 'chat'|'image'|'video'|'code'|'document'|'file_generation'|'summarization'|'vision';
export type SafetyProfile = 'safe_default'|'creative'|'low_refusal_allowed'|'strict'|'adult_text_allowed_where_legal'|'image_video_strict';
export type OutputPlan = 'telegram_text'|'telegram_markdown'|'telegram_code_block'|'telegram_document'|'telegram_photo'|'telegram_video'|'mixed';
export interface PromptClassification { taskType: SmartTaskType; intent: string; language: string; needsFile: boolean; needsCode: boolean; needsImage: boolean; needsVideo: boolean; needsLongContext: boolean; requestedSafetyProfile: SafetyProfile; allowedAdultText: boolean; blockedReason?: string; suggestedOutputPlan: OutputPlan; tags: string[]; }
const faRe=/[\u0600-\u06FF]/;
const sexual=/(nude|naked|nsfw|porn|explicit sex|sexual|erotic|boobs?|breasts?|nipples?|vagina|penis|برهنه|لخت|سکس|جنسی|پورن|شهوت|پستان|آلت)/i;
const minor=/(minor|child|teen|underage|kid|young girl|young boy|کودک|نوجوان|زیر ?سن|بچه|دختر بچه|پسر بچه)/i;
const unsafe=/(doxx|malware|phishing|steal password|خودکشی|ساخت بمب|بدافزار|فیشینگ|کلاهبرداری|دزدیدن رمز)/i;
export class PromptClassifier {
  classify(prompt:string, hintedTask?:SmartTaskType): PromptClassification {
    const p=prompt||''; const lower=p.toLowerCase(); const tags:string[]=[];
    const needsImage=/(image|photo|picture|draw|generate.*art|عکس|تصویر|نقاشی|بساز.*عکس|ساخت عکس|شبیه قبلی|همین سبک)/i.test(p) || hintedTask==='image';
    const needsVideo=/(video|clip|animation|ویدیو|کلیپ|انیمیشن|ساخت ویدیو)/i.test(p) || hintedTask==='video';
    const needsCode=/(code|typescript|javascript|python|react|sql|bug|function|کد|برنامه|اسکریپت|تابع|دیباگ)/i.test(p) || hintedTask==='code';
    const needsFile=/(file|document|pdf|markdown|txt|یه فایل|فایل آماده|سند|داکیومنت|رزومه)/i.test(p) || hintedTask==='file_generation' || hintedTask==='document';
    if(faRe.test(p))tags.push('persian'); if(needsCode)tags.push('coding'); if(needsFile)tags.push('file');
    const asksLessCensored=/(uncensored|less censored|بدون سانسور|کمتر سانسور|رک و بی‌پرده)/i.test(p);
    const visual=needsImage||needsVideo; const sexualHit=sexual.test(p); const minorHit=minor.test(p); const unsafeHit=unsafe.test(p);
    let blockedReason: string|undefined;
    if(visual&&sexualHit) blockedReason='blocked_sexual_visual';
    if(visual&&minorHit) blockedReason='blocked_minor_visual_risk';
    if(unsafeHit) blockedReason='blocked_unsafe_request';
    let taskType:SmartTaskType=hintedTask||'chat';
    if(needsVideo)taskType='video'; else if(needsImage)taskType='image'; else if(needsCode)taskType='code'; else if(needsFile)taskType='file_generation';
    const allowedAdultText=!visual&&sexualHit&&!minorHit&&!unsafeHit;
    const outputPlan:OutputPlan=needsVideo?'telegram_video':needsImage?'telegram_photo':needsFile?'telegram_document':needsCode?'telegram_code_block':'telegram_text';
    return {taskType,intent:taskType,language:faRe.test(p)?'fa':'unknown',needsFile,needsCode,needsImage,needsVideo,needsLongContext:p.length>6000,requestedSafetyProfile:asksLessCensored||allowedAdultText?'low_refusal_allowed':'safe_default',allowedAdultText,blockedReason,suggestedOutputPlan:outputPlan,tags};
  }
}
export interface RouterModel { provider:string; modelId:string; displayName?:string; enabled?:boolean; capabilities:string[]; taskTypes:SmartTaskType[]; safetyProfiles:SafetyProfile[]; qualityScore?:number; speedScore?:number; costScore?:number; persianScore?:number; codingScore?:number; imageScore?:number; videoScore?:number; priority?:number; inputCostUsdPer1M?:number|null; outputCostUsdPer1M?:number|null; imageCostUsd?:number|null; videoCostUsd?:number|null; performance?:{successCount?:number; failCount?:number; avgLatencyMs?:number; recentFailureCount?:number}|null; }
export interface SelectModelInput { userId:string; threadId?:string; taskType:SmartTaskType; prompt:string; desiredOutput?:string; safetyProfile?:SafetyProfile; userPreference?:'faster'|'cheaper'|'higher_quality'|'less_censored'|'safer'; needsCodeFormatting?:boolean; needsFileOutput?:boolean; needsLongContext?:boolean; referenceAssetIds?:string[]; models?:RouterModel[]; walletBalance?:number; confirmationThreshold?:number; }
export class ModelRouter {
  constructor(private classifier=new PromptClassifier()){}
  selectModel(input:SelectModelInput){
    const classification=this.classifier.classify(input.prompt,input.taskType); const safetyDecision={allowed:!classification.blockedReason, blockedReason:classification.blockedReason, profile:input.safetyProfile||classification.requestedSafetyProfile};
    if(!safetyDecision.allowed) return {provider:null,model:null,reason:'safety_block',estimatedCost:0,requiresConfirmation:false,fallbackCandidates:[],safetyDecision,outputPlan:classification.suggestedOutputPlan,classification};
    const needCaps=new Set<string>();
    if(['chat','summarization','document','file_generation','code'].includes(classification.taskType)) needCaps.add('text');
    if(classification.taskType==='code') needCaps.add('coding'); if(classification.needsImage) needCaps.add(classification.tags.includes('similar')?'image_editing':'image_generation'); if(classification.needsVideo) needCaps.add('video_generation'); if(classification.needsFile) needCaps.add('file_output'); if(classification.language==='fa') needCaps.add('persian_quality'); if(classification.needsLongContext||input.needsLongContext) needCaps.add('long_context'); if((input.userPreference==='less_censored'||classification.requestedSafetyProfile==='low_refusal_allowed')&&classification.allowedAdultText) needCaps.add('low_refusal_allowed_content');
    const models=(input.models||defaultRouterModels()).filter(m=>m.enabled!==false&&m.taskTypes.includes(classification.taskType)&&[...needCaps].every(c=>m.capabilities.includes(c)||c==='persian_quality'));
    const scored=models.map(m=>({m,score:this.score(m,input,classification)})).sort((a,b)=>b.score-a.score);
    const selected=scored[0]?.m; const fallbackCandidates=scored.slice(1,4).map(x=>({provider:x.m.provider,model:x.m.modelId,score:x.score}));
    if(!selected) return {provider:null,model:null,reason:'no_model',estimatedCost:0,requiresConfirmation:false,fallbackCandidates:[],safetyDecision:{...safetyDecision,allowed:false,blockedReason:'no_model'},outputPlan:classification.suggestedOutputPlan,classification};
    const estimatedCost=this.estimate(selected,classification.taskType); const threshold=input.confirmationThreshold??10000;
    return {provider:selected.provider,model:selected.modelId,reason:`selected by task/capability score for ${classification.taskType}`,estimatedCost,requiresConfirmation:Boolean(input.walletBalance!==undefined&&estimatedCost>threshold),fallbackCandidates,safetyDecision,outputPlan:classification.suggestedOutputPlan,classification};
  }
  private score(m:RouterModel,input:SelectModelInput,c:PromptClassification){let s=100-(m.priority??100)+(m.qualityScore??5)*4+(m.persianScore??5)*(c.language==='fa'?5:1)+(m.codingScore??5)*(c.needsCode?6:0)+(m.imageScore??5)*(c.needsImage?6:0)+(m.videoScore??5)*(c.needsVideo?6:0)+(m.costScore??5)*(input.userPreference==='cheaper'?5:1)+(m.speedScore??5)*(input.userPreference==='faster'?5:1); const p=m.performance; if(p){const total=(p.successCount||0)+(p.failCount||0); if(total)s+=((p.successCount||0)/total)*20; s-= (p.recentFailureCount||0)*10; s-= Math.min(10,Math.floor((p.avgLatencyMs||0)/3000));} if(input.userPreference==='higher_quality')s+=(m.qualityScore??5)*8; return s;}
  private estimate(m:RouterModel,t:SmartTaskType){if(t==='image')return Math.ceil((m.imageCostUsd||0.04)*60000*2)||5000; if(t==='video')return Math.ceil((m.videoCostUsd||0.25)*60000*2)||25000; return 1000;}
}
export function defaultRouterModels():RouterModel[]{return [{provider:'venice',modelId:process.env.VENICE_TEXT_MODEL||'auto',enabled:true,capabilities:['text','reasoning','persian_quality','telegram_formatting','long_context'],taskTypes:['chat','summarization','document'],safetyProfiles:['safe_default','creative'],qualityScore:7,persianScore:8,priority:50},{provider:'venice',modelId:process.env.VENICE_TEXT_MODEL||'auto',enabled:true,capabilities:['text','reasoning','coding','file_output','json_mode','telegram_formatting','persian_quality'],taskTypes:['code','file_generation','document'],safetyProfiles:['safe_default','strict'],qualityScore:7,codingScore:8,priority:45},{provider:'venice',modelId:process.env.VENICE_LOW_REFUSAL_TEXT_MODEL||process.env.VENICE_TEXT_MODEL||'auto',enabled:Boolean(process.env.VENICE_LOW_REFUSAL_TEXT_MODEL),capabilities:['text','low_refusal_allowed_content','persian_quality'],taskTypes:['chat'],safetyProfiles:['low_refusal_allowed','adult_text_allowed_where_legal'],qualityScore:6,persianScore:7,priority:60},{provider:'venice',modelId:process.env.VENICE_IMAGE_MODEL||'z-image-turbo',enabled:true,capabilities:['image_generation','image_editing','persian_quality'],taskTypes:['image'],safetyProfiles:['image_video_strict','safe_default'],imageScore:8,priority:40,imageCostUsd:0.04},{provider:'venice',modelId:process.env.VENICE_VIDEO_MODEL||'auto',enabled:true,capabilities:['video_generation'],taskTypes:['video'],safetyProfiles:['image_video_strict','safe_default'],videoScore:6,priority:70,videoCostUsd:0.25}];}
