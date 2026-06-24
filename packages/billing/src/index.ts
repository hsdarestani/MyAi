import { PrismaClient, LedgerType, TaskType } from '@moones/db';
export function roundToNearest(v:number, step:number){ return Math.max(step, Math.round(v/step)*step); }
export async function calculatePrice(db:PrismaClient, taskType:TaskType, providerCostInToman:number){ const c=await db.pricingConfig.findUniqueOrThrow({where:{taskType}}); const raw=c.fixedBaseFee+providerCostInToman*c.markupMultiplier; return Math.max(c.minCharge, roundToNearest(raw,c.roundingStep)); }
export async function adjustWallet(db:PrismaClient,userId:string,amount:number,type:LedgerType,description:string,adminId?:string,metadata?:object){ return db.$transaction(async tx=>{ const u=await tx.user.findUniqueOrThrow({where:{id:userId}}); const after=u.walletBalance+amount; if(after<0) throw new Error('INSUFFICIENT_BALANCE'); const ledger=await tx.walletLedger.create({data:{userId,type,amount,balanceBefore:u.walletBalance,balanceAfter:after,description,createdByAdminId:adminId,metadata:metadata as any}}); const user=await tx.user.update({where:{id:userId},data:{walletBalance:after}}); return {user,ledger}; }); }
export async function chargeUsage(db:PrismaClient,userId:string,amount:number,description:string,metadata?:object){ return adjustWallet(db,userId,-amount,LedgerType.USAGE_CHARGE,description,undefined,metadata); }
export async function reserve(db:PrismaClient,userId:string,amount:number,description:string){ return adjustWallet(db,userId,-amount,LedgerType.RESERVATION,description); }
export async function refund(db:PrismaClient,userId:string,amount:number,description:string){ return adjustWallet(db,userId,amount,LedgerType.REFUND,description); }

export * from './payments/index.js';
