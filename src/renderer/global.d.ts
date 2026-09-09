import type { AppApi } from "../preload/index";
declare global { interface Window { appApi: AppApi; } }
export {};
