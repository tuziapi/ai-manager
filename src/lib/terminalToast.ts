import { useAppStore } from '../stores/appStore';

const TOAST_TITLE = '请打开新的终端';
const TOAST_MESSAGE =
  '安装或线路配置已写入 shell 环境或配置文件，请新开一个终端窗口后再使用 CLI，否则可能仍使用旧环境。';

export function showNewTerminalToast(): void {
  useAppStore.getState().addNotification({
    type: 'info',
    title: TOAST_TITLE,
    message: TOAST_MESSAGE,
  });
}

function matchesClaudeTerminalAction(actionId: string): boolean {
  if (actionId.startsWith('uninstall-')) return false;
  if (actionId.startsWith('install-')) return true;
  if (actionId.startsWith('switch-')) return true;
  if (actionId.startsWith('update-key-')) return true;
  if (actionId === 'route-add') return true;
  if (actionId.startsWith('upgrade-')) return true;
  return false;
}

function matchesCodexTerminalAction(actionId: string): boolean {
  if (actionId.startsWith('uninstall-')) return false;
  if (actionId.startsWith('install-')) return true;
  if (actionId === 'reinstall-openai') return true;
  if (actionId.startsWith('switch-')) return true;
  if (actionId === 'codex-route-add') return true;
  if (actionId.startsWith('upgrade-')) return true;
  return false;
}

/** 安装、升级、线路切换等成功后提示用户新开终端 */
export function showNewTerminalToastIfNeeded(
  module: 'claude' | 'codex',
  actionId: string,
  result: { success: boolean; restart_required?: boolean }
): void {
  if (!result.success) return;
  if (result.restart_required) {
    showNewTerminalToast();
    return;
  }
  const match =
    module === 'claude'
      ? matchesClaudeTerminalAction(actionId)
      : matchesCodexTerminalAction(actionId);
  if (match) showNewTerminalToast();
}
