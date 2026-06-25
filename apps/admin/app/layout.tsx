import './globals.css';
import {AdminShell} from './components/admin-client';
export const metadata={title:'پنل مدیریت اوستا'};
export default function Root({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body><AdminShell>{children}</AdminShell></body></html>}
