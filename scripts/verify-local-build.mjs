import { build } from "vite";
import react from "@vitejs/plugin-react";
import { tmpdir } from "node:os";
import { join } from "node:path";
await build({configFile:false,root:process.cwd(),plugins:[react()],build:{outDir:join(tmpdir(),"copiloto-monthly-local"),emptyOutDir:false}});
