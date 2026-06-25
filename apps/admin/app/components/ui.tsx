export const fmt=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));
export function Money({value}:{value:any}){return <span>{fmt(value)} تومان</span>}
export function DateTime({value}:{value:any}){return <span>{value?new Date(value).toLocaleString('fa-IR'):''}</span>}
export function Badge({children,tone='neutral'}:{children:any;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}
export function PageHeader({title,desc,actions}:{title:string;desc?:string;actions?:any}){return <div className="top"><div><h1>{title}</h1>{desc&&<p className="muted">{desc}</p>}</div><div>{actions}</div></div>}
export function SectionCard({title,children,...rest}:{title?:string;children:any;[key:string]:any}){return <section className="card" {...rest}>{title&&<h2>{title}</h2>}{children}</section>}
export function EmptyState({text='هنوز داده‌ای ثبت نشده'}:{text?:string}){return <div className="empty">{text}</div>}
export function StatCard({label,value}:{label:string;value:any}){return <div className="card stat"><span>{label}</span><strong>{typeof value==='number'?fmt(value):value}</strong></div>}
export function Table({headers,children}:{headers:string[];children:any}){return <div className="tableWrap"><table className="table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
export function InlineAlert({children,tone='error'}:any){return <div className={`alert ${tone}`}>{children}</div>}
export const DataTable=Table; export const ActionButtonStub=()=>null;
