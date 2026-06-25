import { PrismaClient, TaskType } from '@prisma/client';import bcrypt from 'bcryptjs';
const prisma=new PrismaClient();
const email = process.env.ADMIN_EMAIL || 'admin@moones.top';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const routeDefaults:{taskType:TaskType;enabled:boolean}[]=[{taskType:'chat',enabled:true},{taskType:'image',enabled:false},{taskType:'video',enabled:false}];
for (const r of routeDefaults) {
  await prisma.aIRouteConfig.upsert({ where:{taskType:r.taskType}, update:{provider:'auto',model:'auto',enabled:r.enabled}, create:{ taskType:r.taskType, provider:'auto', model:'auto', fallbackProvider:null, fallbackModel:null, enabled:r.enabled }});
}
for (const t of ['chat','image','video'] as TaskType[]) await prisma.pricingConfig.upsert({ where:{taskType:t}, update:{}, create:{ taskType:t, minCharge:t==='chat'?1000:t==='image'?5000:25000, fixedBaseFee:0, markupMultiplier:2, highCostThreshold:t==='video'?20000:10000, enabled:t==='chat' }});
await prisma.admin.upsert({ where:{email}, update:{}, create:{email,passwordHash:await bcrypt.hash(password,12),role:'owner'} });
await prisma.setting.upsert({where:{key:'brandName'},update:{value:'اوستا'},create:{key:'brandName',value:'اوستا'}});
console.log('Seeded Osta defaults');
await prisma.$disconnect();
