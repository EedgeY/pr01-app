'use client';

import { Button } from '@workspace/ui/components/button';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Download,
} from 'lucide-react';

interface StatusBarProps {
  isSaving: boolean;
  lastSaved: Date | null;
  onSave: () => void;
  onExport: () => void;
  leftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  designName: string;
}

export function StatusBar({
  isSaving,
  lastSaved,
  onSave,
  onExport,
  leftPanelOpen,
  onToggleLeftPanel,
  rightPanelOpen,
  onToggleRightPanel,
  designName,
}: StatusBarProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="h-12 border-t border-gray-200 bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleLeftPanel}
          className="h-8 w-8 p-0"
        >
          {leftPanelOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>
        <span className="text-sm font-medium text-gray-700">{designName}</span>
      </div>

      <div className="flex items-center gap-3">
        {isSaving ? (
          <span className="text-xs text-gray-500">保存中...</span>
        ) : lastSaved ? (
          <span className="text-xs text-gray-500">
            保存済み {formatTime(lastSaved)}
          </span>
        ) : (
          <span className="text-xs text-gray-400">未保存</span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-8 gap-2"
        >
          <Save className="h-4 w-4" />
          保存
        </Button>

        <Button variant="ghost" size="sm" onClick={onExport} className="h-8 gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleRightPanel}
          className="h-8 w-8 p-0"
        >
          {rightPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

