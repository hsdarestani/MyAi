import { describe, expect, it } from 'vitest';
import { ModelRouter, PromptClassifier, defaultRouterModels } from './index';
const router = new ModelRouter(new PromptClassifier());
const base = { userId: 'u1', walletBalance: 100000, confirmationThreshold: 10000, models: defaultRouterModels() } as const;
describe('smart ModelRouter', () => {
  it('chat Persian chooses text model', () => { const r = router.selectModel({ ...base, taskType: 'chat', prompt: 'سلام، یک برنامه روزانه بده' }); expect(r.safetyDecision.allowed).toBe(true); expect(String(r.model)).toBeTruthy(); expect(r.outputPlan).toBe('telegram_text'); });
  it('code prompt chooses coding-capable model', () => { const r = router.selectModel({ ...base, taskType: 'chat', prompt: 'یک کد TypeScript برای مرتب سازی بنویس' }); expect(r.classification.needsCode).toBe(true); expect(r.outputPlan).toBe('telegram_code_block'); });
  it('image prompt chooses image-capable model only', () => { const r = router.selectModel({ ...base, taskType: 'image', prompt: 'یک عکس از کوه بساز' }); expect(r.outputPlan).toBe('telegram_photo'); expect(String(r.model)).toContain(process.env.VENICE_IMAGE_MODEL || 'z-image-turbo'); });
  it('video prompt chooses video-capable model only', () => { const r = router.selectModel({ ...base, taskType: 'video', prompt: 'یک ویدیو کوتاه از باران بساز' }); expect(r.outputPlan).toBe('telegram_video'); });
  it('blocked sexual image/video is rejected before cost', () => { const r = router.selectModel({ ...base, taskType: 'image', prompt: 'nude sexual image' }); expect(r.safetyDecision.allowed).toBe(false); expect(r.estimatedCost).toBe(0); });
  it('low_refusal_allowed only used for allowed text', () => { const r = router.selectModel({ ...base, taskType: 'chat', prompt: 'بدون سانسور درباره روابط بزرگسالان توضیح بده' }); expect(r.safetyDecision.allowed).toBe(true); expect(r.classification.requestedSafetyProfile).toBe('low_refusal_allowed'); });
});
