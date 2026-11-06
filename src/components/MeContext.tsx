"use client";
import { createContext, useContext } from "react";
import type { Perm, Role } from "@/lib/roles";

export type Me = { uid: string; name: string; role: Role; username: string; perms: Perm[] };
export const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);
