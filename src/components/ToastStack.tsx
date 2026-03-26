import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Info, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

const AUTO_DISMISS_MS = 6500;

function ToastItem({
  id,
  type,
  title,
  message,
}: {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}) {
  const removeNotification = useAppStore((s) => s.removeNotification);

  useEffect(() => {
    const t = window.setTimeout(() => removeNotification(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [id, removeNotification]);

  const icon =
    type === 'success' ? (
      <CheckCircle className="text-green-400 shrink-0" size={18} />
    ) : type === 'error' ? (
      <AlertCircle className="text-red-400 shrink-0" size={18} />
    ) : type === 'warning' ? (
      <AlertTriangle className="text-yellow-400 shrink-0" size={18} />
    ) : (
      <Info className="text-claw-300 shrink-0" size={18} />
    );

  const border =
    type === 'success'
      ? 'border-green-500/35'
      : type === 'error'
        ? 'border-red-500/35'
        : type === 'warning'
          ? 'border-yellow-500/35'
          : 'border-claw-500/35';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={`pointer-events-auto max-w-sm w-[min(100vw-2rem,22rem)] rounded-xl border ${border} bg-dark-800/95 backdrop-blur-sm shadow-lg shadow-black/40`}
    >
      <div className="flex gap-3 p-3.5 pr-2">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white leading-snug">{title}</p>
          {message && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => removeNotification(id)}
          className="shrink-0 p-1 rounded-md text-gray-500 hover:text-white hover:bg-dark-600 transition-colors"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

export function ToastStack() {
  const notifications = useAppStore((s) => s.notifications);

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-2 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <ToastItem key={n.id} id={n.id} type={n.type} title={n.title} message={n.message} />
        ))}
      </AnimatePresence>
    </div>
  );
}
