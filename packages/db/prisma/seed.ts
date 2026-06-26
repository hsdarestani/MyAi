import { PrismaClient, TaskType } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL || 'admin@moones.top';
const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const taskTypes = ['chat','image','video','code','document','file_generation','summarization','vision'] as TaskType[];
const defaults: Record<string, string> = { chat: process.env.VENICE_TEXT_MODEL || 'auto', image: process.env.VENICE_IMAGE_MODEL || 'z-image-turbo', video: process.env.VENICE_VIDEO_MODEL || 'auto', code: process.env.VENICE_TEXT_MODEL || 'auto', document: process.env.VENICE_TEXT_MODEL || 'auto', file_generation: process.env.VENICE_TEXT_MODEL || 'auto', summarization: process.env.VENICE_TEXT_MODEL || 'auto', vision: process.env.VENICE_TEXT_MODEL || 'auto' };
for (const taskType of taskTypes) {
  const existing = await prisma.aIRouteConfig.findUnique({ where: { taskType } });
  await prisma.aIRouteConfig.upsert({ where: { taskType }, update: { provider: existing?.provider || 'auto', model: existing?.model || defaults[taskType], enabled: existing?.enabled ?? true }, create: { taskType, provider: 'auto', model: defaults[taskType], enabled: true } });
  await prisma.pricingConfig.upsert({ where: { taskType }, update: { enabled: true }, create: { taskType, minCharge: taskType === 'chat' ? 1000 : taskType === 'image' ? 5000 : taskType === 'video' ? 25000 : 1500, fixedBaseFee: 0, markupMultiplier: 2, highCostThreshold: taskType === 'video' ? 20000 : 10000, maxWithoutConfirmation: 10000, roundingStep: 500, enabled: true } });
}
await prisma.admin.upsert({ where: { email }, update: {}, create: { email, passwordHash: await bcrypt.hash(password, 12), role: 'owner' } });
const settings: Record<string, any> = { brandName: 'اوستا', defaultCostConfirmationThreshold: Number(process.env.DEFAULT_COST_CONFIRMATION_THRESHOLD_TOMAN || 10000), usdToToman: Number(process.env.USD_TO_TOMAN || 60000), DONATION_PAYMENT_URL: process.env.DONATION_PAYMENT_URL || '', DONATION_PAYMENT_TITLE: 'افزایش موجودی', ADMIN_TELEGRAM_IDS: process.env.ADMIN_TELEGRAM_IDS || '316244055', TOPUP_MIN_AMOUNT: Number(process.env.TOPUP_MIN_AMOUNT || 0), WALLET_WITHDRAWAL_ENABLED: false, DEFAULT_SAFETY_PROFILE: 'safe_default', LOW_REFUSAL_ALLOWED_TEXT_ENABLED: Boolean(process.env.VENICE_LOW_REFUSAL_TEXT_MODEL) };
for (const [key, value] of Object.entries(settings)) await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
const provider = await prisma.modelProvider.upsert({ where: { name: 'venice' }, update: { enabled: true, baseUrl: 'https://api.venice.ai/api/v1', apiKeyEnvName: 'VENICE_API_KEY' }, create: { name: 'venice', displayName: 'Osta AI Route', enabled: true, baseUrl: 'https://api.venice.ai/api/v1', apiKeyEnvName: 'VENICE_API_KEY' } });
async function model(modelId: string, displayName: string, capabilities: string[], tasks: string[], safetyProfiles: string[], scores: any = {}) { await prisma.aIModel.upsert({ where: { providerId_modelId: { providerId: provider.id, modelId } }, update: { displayName, capabilities, taskTypes: tasks, safetyProfiles, enabled: true, ...scores }, create: { providerId: provider.id, modelId, displayName, capabilities, taskTypes: tasks, safetyProfiles, enabled: true, ...scores } }); }
await model(process.env.VENICE_TEXT_MODEL || 'auto', 'Osta Text/Coding Auto', ['text','reasoning','persian_quality','telegram_formatting','long_context','coding','file_output','json_mode'], ['chat','summarization','document','code','file_generation'], ['safe_default','creative','strict'], { qualityScore: 7, persianScore: 8, codingScore: 8, priority: 45 });
await model(process.env.VENICE_IMAGE_MODEL || 'z-image-turbo', 'Osta Image', ['image_generation','image_editing','persian_quality'], ['image'], ['image_video_strict','safe_default'], { imageScore: 8, priority: 40, imageCostUsd: 0.04 });
await model(process.env.VENICE_VIDEO_MODEL || 'auto-video', 'Osta Video', ['video_generation'], ['video'], ['image_video_strict','safe_default'], { videoScore: 6, priority: 70, videoCostUsd: 0.25 });
if (process.env.VENICE_LOW_REFUSAL_TEXT_MODEL) await model(process.env.VENICE_LOW_REFUSAL_TEXT_MODEL, 'Osta Allowed Sensitive Text', ['text','low_refusal_allowed_content','persian_quality'], ['chat'], ['low_refusal_allowed','adult_text_allowed_where_legal'], { qualityScore: 6, persianScore: 7, priority: 60 });
console.log('Seeded Osta defaults without wiping data');
await prisma.$disconnect();
