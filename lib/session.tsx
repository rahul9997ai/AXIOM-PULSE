import {createContext,useContext,useEffect,useState,ReactNode} from 'react';
import {Session} from '@supabase/supabase-js'; import {supabase} from './supabase';
type Ctx={session:Session|null;profile:any;loading:boolean;refresh:()=>Promise<void>};
const C=createContext<Ctx>({session:null,profile:null,loading:true,refresh:async()=>{}});
export function SessionProvider({children}:{children:ReactNode}){const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<any>(null),[loading,setLoading]=useState(true);
 const refresh=async()=>{const {data:{session:s}}=await supabase.auth.getSession();setSession(s);if(s){const {data}=await supabase.from('profiles').select('*').eq('id',s.user.id).single();setProfile(data)}else setProfile(null);setLoading(false)};
 useEffect(()=>{refresh();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{refresh()});return()=>subscription.unsubscribe()},[]);
 return <C.Provider value={{session,profile,loading,refresh}}>{children}</C.Provider>}
export const useSession=()=>useContext(C);
