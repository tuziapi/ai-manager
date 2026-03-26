import { ReactNode } from 'react';
import { Terminal, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface InstallActionCardProps {
  title: string;
  description: string;
  onAction: () => void;
  actionLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  helperText?: string;
  children?: ReactNode;
}

export function InstallActionCard({
  title,
  description,
  onAction,
  actionLabel = '立即执行',
  disabled = false,
  loading = false,
  helperText,
  children,
}: InstallActionCardProps) {
  const ctaInner = (
    <>
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Terminal size={12} />}
      {actionLabel}
    </>
  );

  // 有表单时：标题区不可点，避免用户只在输入框区域操作却点不到安装；主按钮放在表单下方
  if (children) {
    return (
      <div className="install-card flex flex-col h-full">
        <div className="text-left text-sm text-gray-200">
          <p className="font-medium text-white mb-1">{title}</p>
          <p className="text-xs text-gray-400">{description}</p>
          {helperText && <p className="text-xs text-gray-400 mt-2">{helperText}</p>}
        </div>
        <div className={clsx('mt-3 space-y-2 flex-1')}>{children}</div>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="group w-full mt-4 disabled:opacity-50 rounded-lg border border-dark-500 bg-dark-700/80 px-3 py-2.5 hover:bg-dark-500/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-claw-500/50"
        >
          <span className="install-action-btn inline-flex w-full items-center justify-center gap-1.5">
            {ctaInner}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="install-card">
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="group w-full text-left disabled:opacity-50"
      >
        <p className="font-medium text-white mb-1">{title}</p>
        <p className="text-xs text-gray-400">{description}</p>
        {helperText && <p className="text-xs text-gray-400 mt-2">{helperText}</p>}
        <span className="install-action-btn mt-3 inline-flex items-center gap-1.5">{ctaInner}</span>
      </button>
    </div>
  );
}

