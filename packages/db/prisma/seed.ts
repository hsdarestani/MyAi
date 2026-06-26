import { PrismaClient, TaskType } from '@prisma/client';import bcrypt from 'bcryptjs';
const prisma=new PrismaClient();
const email = process.env.ADMIN_EMAIL || 'admin@moones.top';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const defaults:Record<TaskType,string>={chat:process.env.VENICE_TEXT_MODEL||'auto',image:process.env.VENICE_IMAGE_MODEL||'z-image-turbo',video:process.env.VENICE_VIDEO_MODEL||'auto'};
for (const taskType of ['chat','image','video'] as TaskType[]) {
  const existing=await prisma.aIRouteConfig.findUnique({where:{taskType}});
  let model=existing?.model||defaults[taskType];
  if(taskType==='image'&&(!model||model==='auto'||/^zai-org-glm/i.test(model))) model='z-image-turbo';
  if(taskType==='video'&&/^zai-org-glm/i.test(model)) model='auto';
  await prisma.aIRouteConfig.upsert({ where:{taskType}, update:{provider:existing?.provider||'auto',model,enabled:existing?.enabled??true}, create:{ taskType, provider:'auto', model, fallbackProvider:null, fallbackModel:null, enabled:true }});
}
for (const t of ['chat','image','video'] as TaskType[]) await prisma.pricingConfig.upsert({ where:{taskType:t}, update:{enabled:true}, create:{ taskType:t, minCharge:t==='chat'?1000:t==='image'?5000:25000, fixedBaseFee:0, markupMultiplier:2, highCostThreshold:t==='video'?20000:10000, enabled:true }});
await prisma.admin.upsert({ where:{email}, update:{}, create:{email,passwordHash:await bcrypt.hash(password,12),role:'owner'} });
const settings:any={brandName:'اوستا',defaultCostConfirmationThreshold:Number(process.env.DEFAULT_COST_CONFIRMATION_THRESHOLD_TOMAN||10000),usdToToman:Number(process.env.USD_TO_TOMAN||60000),DONATION_PAYMENT_URL:process.env.DONATION_PAYMENT_URL||'',DONATION_PAYMENT_TITLE:'افزایش موجودی',ADMIN_TELEGRAM_IDS:process.env.ADMIN_TELEGRAM_IDS||'316244055',TOPUP_MIN_AMOUNT:Number(process.env.TOPUP_MIN_AMOUNT||0),WALLET_WITHDRAWAL_ENABLED:false};
for(const [key,value] of Object.entries(settings)) await prisma.setting.upsert({where:{key},update:{value},create:{key,value}});
console.log('Seeded Osta defaults');
await prisma.$disconnect();
