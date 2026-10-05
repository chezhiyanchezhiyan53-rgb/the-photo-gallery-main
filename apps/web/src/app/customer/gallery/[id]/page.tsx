"use client";
import {use} from "react";
import CustomerGallery from "@/components/CustomerGallery";
export default function Page({params}:{params:Promise<{id:string}>}){const {id}=use(params);return <CustomerGallery id={id}/>;}
