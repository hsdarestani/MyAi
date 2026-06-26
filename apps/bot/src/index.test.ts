import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { API_DOWN_MESSAGE, costConfirmationKeyboard, post, safeSendMessage, safeReply } from './index';

describe('telegram cost confirmation safety',()=>{
  it('uses fixed short callback_data under 64 bytes',()=>{
    const markup:any=costConfirmationKeyboard();
    const buttons=markup.reply_markup.inline_keyboard.flat();
    expect(buttons.map((b:any)=>b.callback_data)).toEqual(['cost_confirm','cost_cancel']);
    for(const b of buttons) expect(Buffer.byteLength(b.callback_data,'utf8')).toBeLessThan(64);
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
    const fetchImpl=vi.fn()
      .mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'down'})})
      .mockResolvedValueOnce({ok:false,status:502,json:async()=>({error:'down'})})
      .mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});
    await expect(post('/x',{}, {fetchImpl:fetchImpl as any})).resolves.toEqual({ok:true});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('state safety regression',()=>{
  it('settings text is handled before AI usage',()=>{
    const source=readFileSync(new URL('./index.ts',import.meta.url),'utf8');
    expect(source.indexOf("mode==='SETTINGS'")).toBeGreaterThan(-1);
    expect(source.indexOf("mode==='SETTINGS'")).toBeLessThan(source.indexOf("post('/api/bot/run'"));
  });
});
