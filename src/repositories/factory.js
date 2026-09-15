import { supabase } from "../services/supabase/client.js";
import { assertFinanceRepository } from "./contracts.js";
import { createLocalFinanceRepository } from "./localFinanceRepository.js";
import { createSupabaseFinanceRepository } from "./supabaseFinanceRepository.js";

export function createFinanceRepository(user) {
  const explicitLocal = import.meta.env.VITE_DATA_MODE === "local";
  if (explicitLocal) return assertFinanceRepository(createLocalFinanceRepository());
  if (!supabase || !user?.id) return null;
  return assertFinanceRepository(createSupabaseFinanceRepository(supabase, user.id));
}

