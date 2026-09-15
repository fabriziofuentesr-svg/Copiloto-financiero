import { supabase } from "../services/supabase/client.js";
import { assertFinanceRepository } from "./contracts.js";
import { createLocalFinanceRepository } from "./localFinanceRepository.js";
import { createSupabaseFinanceRepository } from "./supabaseFinanceRepository.js";

export function createFinanceRepository(auth) {
  if (auth?.status === "guest") return assertFinanceRepository(createLocalFinanceRepository());
  if (!supabase || auth?.status !== "authenticated" || !auth.user?.id) return null;
  return assertFinanceRepository(createSupabaseFinanceRepository(supabase, auth.user.id));
}
