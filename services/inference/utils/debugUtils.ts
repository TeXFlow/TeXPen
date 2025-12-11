
declare global {
  interface Window {
    __texpen_logs__?: string[];
  }
}

/**
 * Log message to specific window global for easy debugging in browser console
 * or via browser automation agent.
 */
export function logToWindow(msg: string, ...args: any[]) {
  const text = `[${new Date().toISOString()}] ${msg} ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a, (k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (k === 'data' || k === 'buffer') return '[Binary]';
      return v;
    }) : String(a)
  ).join(' ')}`;

  console.log(msg, ...args);

  if (typeof window !== 'undefined') {
    if (!window.__texpen_logs__) {
      window.__texpen_logs__ = [];
    }
    window.__texpen_logs__.push(text);
  }
}
