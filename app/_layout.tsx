import {Stack} from 'expo-router'; import {StatusBar} from 'expo-status-bar'; import {SessionProvider} from '@/lib/session';
export default function Root(){return <SessionProvider><StatusBar style="light"/><Stack screenOptions={{headerShown:false}}/></SessionProvider>}
