import {ClientDetails} from "@/components/EntityDetails";
export default async function Page({params}:{params:Promise<{clientId:string}>}){const {clientId}=await params;return <ClientDetails id={clientId}/>;}
