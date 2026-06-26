import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { API_DOWN_MESSAGE, costConfirmationKeyboard, isExplicitSexualVisualPrompt, post } from './index';
import { INVALID_CALLBACK, safeReply, safeSendMessage, sanitizeInlineKeyboard } from './telegramSafe';

describe('telegram cost confirmation safety',()=>{
  it('uses fixed short callback_data under 64 bytes',()=>{
    const markup:any=costConfirmationKeyboard();
    const buttons=markup.reply_markup.inline_keyboard.flat();
    expect(buttons.map((b:any)=>b.callback_data)).toEqual(['cost_confirm','cost_cancel']);
    for(const b of buttons) expect(Buffer.byteLength(b.callback_data,'utf8')).toBeLessThan(64);
  });
  it('sanitizes invalid callback_data and preserves valid callbacks',()=>{
    const markup:any={reply_markup:{inline_keyboard:[[{text:'long',callback_data:'x'.repeat(65)}],[{text:'json',callback_data:JSON.stringify({prompt:'hello'})}],[{text:'persian prompt',callback_data:'یک دختر کنار دریا'}],[{text:'ok1',callback_data:'cost_confirm'},{text:'ok2',callback_data:'cost_cancel'}],[{text:'receipt',callback_data:'rcpt_ap_abc123'}]]}};
    sanitizeInlineKeyboard(markup);
    const cb=markup.reply_markup.inline_keyboard.flat().map((b:any)=>b.callback_data);
    expect(cb).toEqual([INVALID_CALLBACK,INVALID_CALLBACK,INVALID_CALLBACK,'cost_confirm','cost_cancel','rcpt_ap_abc123']);
  });
  it('safe telegram helpers swallow send failures',async()=>{
    const err=new Error('400 Bad Request: BUTTON_DATA_INVALID');
    const ctx:any={reply:vi.fn().mockRejectedValue(err),telegram:{sendMessage:vi.fn().mockRejectedValue(err)}};
    await expect(safeReply(ctx,'x')).resolves.toBeNull();
    await expect(safeSendMessage(ctx,1,'x')).resolves.toBeNull();
  });
});

describe('api fetch safety',()=>{
  it('returns friendly API-down result instead of throwing',async()=>{
    const fetchImpl=vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNREFUSED'}}));
    const r=await post('/api/bot/run',{},{timeoutMs:10,fetchImpl:fetchImpl as any});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(r.apiDown).toBe(true);
    expect(r.message).toBe(API_DOWN_MESSAGE);
  });
  it('retries 5xx responses twice',async()=>{
    const fetchImpl=vi.fn().mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'down'})}).mockResolvedValueOnce({ok:false,status:502,json:async()=>({error:'down'})}).mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});
    await expect(post('/x',{}, {fetchImpl:fetchImpl as any})).resolves.toEqual({ok:true});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('state and prompt safety regression',()=>{
  it('settings text is handled before AI usage and pending storage exists',()=>{
    const source=readFileSync(new URL('./index.ts',import.meta.url),'utf8');
    expect(source.indexOf("mode==='SETTINGS'")).toBeGreaterThan(-1);
    expect(source.indexOf("mode==='SETTINGS'")).toBeLessThan(source.indexOf("post('/api/bot/run'"));
    expect(source).toContain('/api/bot/pending-request');
  });
  it('rejects explicit sexual visual prompts before run',()=>{
    expect(isExplicitSexualVisualPrompt('nude girl on beach')).toBe(true);
    expect(isExplicitSexualVisualPrompt('dokhtar naked portrait')).toBe(true);
    expect(isExplicitSexualVisualPrompt('گربه در باغ')).toBe(false);
  });
});
