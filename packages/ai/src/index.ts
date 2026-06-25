export type ProviderCost={amountToman:number;estimated?:boolean};
export interface AITextProvider { generateText(input:{prompt:string}):Promise<any> };
export interface AIImageProvider { generateImage(input:{prompt:string}):Promise<any> };
export interface AIVideoProvider { createVideoJob(input:{prompt:string}):Promise<any>; getVideoJob(jobId:string):Promise<any> };

type ChatProviderOptions={provider:string;baseUrl:string;apiKey?:string;model:string;estimatedCostToman?:number};

function isProd(){return process.env.NODE_ENV==='production'}
function mockAllowed(){return process.env.ALLOW_MOCK_AI==='true'&&!isProd()}
function todayForPrompt(){
  const tz=process.env.APP_TIMEZONE||'Asia/Tehran';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:tz,dateStyle:'full',timeStyle:'short'}).format(new Date());
}
function systemPrompt(){return `تو اوستا هستی؛ یک دستیار فارسی ساده، دقیق و مفید. به صورت پیش‌فرض فارسی پاسخ بده، مگر کاربر زبان دیگری بخواهد. برای کاربران عادی غیرتخصصی، کوتاه، روشن و کاربردی توضیح بده. تاریخ امروز در سرور: ${todayForPrompt()}. برای تاریخ و زمان هرگز به تاریخ داخلی مدل تکیه نکن و همین تاریخ سرور را مبنا بگیر.`}

export class MockProvider implements AITextProvider,AIImageProvider,AIVideoProvider{
  private ensureAllowed(){ if(!mockAllowed()) throw new Error('Mock AI is disabled. Configure a real provider.'); }
  async generateText({prompt}:{prompt:string}){this.ensureAllowed();return {text:`پاسخ آزمایشی اوستا:\n${prompt}\n\nاین پاسخ فقط در محیط توسعه تولید شده است.`,usage:{chars:prompt.length},providerCost:{amountToman:0,estimated:true},provider:'mock',model:'mock-chat'}}
  async generateImage({prompt}:{prompt:string}){this.ensureAllowed();return {imageUrl:`https://dummyimage.com/1024x1024/111/fff.png&text=${encodeURIComponent('Osta')}`,usage:{prompt},providerCost:{amountToman:0,estimated:true},provider:'mock',model:'mock-image'}}
  async createVideoJob({prompt}:{prompt:string}){this.ensureAllowed();return {jobId:`mock-${Date.now()}`,estimatedCost:{amountToman:0,estimated:true},provider:'mock',model:'mock-video',prompt}}
  async getVideoJob(jobId:string){this.ensureAllowed();return {status:'completed' as const,videoUrl:'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',providerCost:{amountToman:0,estimated:true},jobId}}
}

export class OpenAICompatibleProvider implements AITextProvider,AIImageProvider,AIVideoProvider{
  protected opts:ChatProviderOptions;
  constructor(opts?:Partial<ChatProviderOptions>){this.opts={provider:opts?.provider||'openai-compatible',baseUrl:(opts?.baseUrl||process.env.OPENAI_COMPATIBLE_BASE_URL||'').replace(/\/$/,''),apiKey:opts?.apiKey||process.env.OPENAI_COMPATIBLE_API_KEY,model:opts?.model||process.env.OPENAI_COMPATIBLE_MODEL||'gpt-4o-mini',estimatedCostToman:opts?.estimatedCostToman??Number(process.env.PROVIDER_TEXT_ESTIMATE_TOMAN||250)}}
  get provider(){return this.opts.provider} get model(){return this.opts.model}
  protected endpoint(){return `${this.opts.baseUrl}/chat/completions`}
  protected validate(){ if(!this.opts.baseUrl) throw new Error(`${this.opts.provider} base URL is not configured`); if(!this.opts.apiKey) throw new Error(`${this.opts.provider} API key is not configured`); }
  async generateText({prompt}:{prompt:string}){
    this.validate();
    const response=await fetch(this.endpoint(),{method:'POST',headers:{Authorization:`Bearer ${this.opts.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.opts.model,messages:[{role:'system',content:systemPrompt()},{role:'user',content:prompt}],temperature:0.7,stream:false,include_reasoning:false,reasoning:false})});
    const data:any=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(`${this.opts.provider} request failed (${response.status})`);
    const content=data?.choices?.[0]?.message?.content;
    if(!content||typeof content!=='string') throw new Error(`${this.opts.provider} returned an empty response`);
    return {text:content.trim(),usage:data?.usage||null,providerCost:{amountToman:this.opts.estimatedCostToman,estimated:true},provider:this.opts.provider,model:this.opts.model};
  }
  async generateImage(){throw new Error('image provider is not configured')}
  async createVideoJob(){throw new Error('video provider is not configured')}
  async getVideoJob(){throw new Error('video provider is not configured')}
}

export class VeniceProvider extends OpenAICompatibleProvider{
  constructor(){super({provider:'venice',baseUrl:'https://api.venice.ai/api/v1',apiKey:process.env.VENICE_API_KEY,model:process.env.VENICE_TEXT_MODEL||'zai-org-glm-4.7',estimatedCostToman:Number(process.env.VENICE_TEXT_ESTIMATE_TOMAN||250)})}
}

export type ProviderMode='mock'|'venice'|'openai-compatible';
export function getAIProvider(mode:ProviderMode|string=process.env.AI_PROVIDER_MODE||'mock'){
  if(mode==='venice') return new VeniceProvider();
  if(mode==='openai-compatible') return new OpenAICompatibleProvider();
  if(mode==='mock') return new MockProvider();
  throw new Error(`Unsupported AI provider: ${mode}`);
}
