import bcrypt from 'bcryptjs';
import { prisma, TaskType } from '../src/index.js';
const email = process.env.ADMIN_EMAIL || 'admin@moones.top';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
for (const t of [TaskType.chat, TaskType.image, TaskType.video]) {
  await prisma.pricingConfig.upsert({ where:{taskType:t}, update:{}, create:{ taskType:t, minCharge:t==='chat'?500:t==='image'?5000:30000, fixedBaseFee:0, markupMultiplier:2, highCostThreshold:t==='video'?30000:10000, maxWithoutConfirmation:t==='chat'?10000:0, roundingStep:500, enabled:true }});
  await prisma.aIRouteConfig.upsert({ where:{taskType:t}, update:{}, create:{ taskType:t, provider:'mock', model:`mock-${t}`, fallbackProvider:'mock', fallbackModel:`mock-${t}`, enabled:true }});
}
await prisma.admin.upsert({ where:{email}, update:{}, create:{email,passwordHash:await bcrypt.hash(password,12),role:'owner'} });
await prisma.setting.upsert({ where:{key:'topupPackages'}, update:{}, create:{key:'topupPackages', value:[50000,100000,250000,500000]} });
await prisma.setting.upsert({ where:{key:'botTexts'}, update:{}, create:{key:'botTexts', value:{support:'@support', maintenance:false}} });
console.log('Seeded Moones AI defaults');
