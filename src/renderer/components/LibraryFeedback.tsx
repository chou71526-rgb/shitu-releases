import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

const FeedbackContext = createContext({ notify: (_message: string, _undo?: () => Promise<void>) => {} });
export const useLibraryFeedback = () => useContext(FeedbackContext);

export function LibraryFeedback({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; undo?: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);
  return <FeedbackContext.Provider value={{ notify: (message, undo) => setNotice({ message, undo }) }}>
    {children}
    {notice && <div className="toast library-feedback" role="status"><span>{notice.message}</span>{notice.undo && <button disabled={busy} onClick={async () => { setBusy(true); try { await notice.undo!(); setNotice((current) => current === notice ? { message: "已恢复图片" } : current); } catch { setNotice((current) => current === notice ? { ...notice, message: "恢复失败，请重试" } : current); } finally { setBusy(false); } }}>{busy ? "恢复中…" : "撤销"}</button>}<button aria-label="关闭提示" onClick={() => setNotice(null)}>×</button></div>}
  </FeedbackContext.Provider>;
}
