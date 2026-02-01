import React, { Suspense } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { useMultiView, type ViewPanel } from '@/contexts/multi-view-context';
import { ViewPanelHeader } from './view-panel-header';
import { ErrorBoundary } from '@/components/error-boundary';
import { cn } from '@/lib/utils';

interface MultiViewContainerProps {
  renderContent: (section: string) => React.ReactNode;
  onSectionChange: (section: string, panelId?: string) => void;
  className?: string;
}

// Loading fallback for lazy-loaded content
const PanelLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
      <p className="text-muted-foreground text-sm">Loading section...</p>
    </div>
  </div>
);

interface SinglePanelContentProps {
  panel: ViewPanel;
  renderContent: (section: string) => React.ReactNode;
  onSectionChange: (section: string, panelId?: string) => void;
  isMultiView: boolean;
}

function SinglePanelContent({
  panel,
  renderContent,
  onSectionChange,
  isMultiView,
}: SinglePanelContentProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Show panel header only in multi-view mode */}
      {isMultiView && (
        <ViewPanelHeader
          panel={panel}
          onSectionChange={(section) => onSectionChange(section, panel.id)}
        />
      )}
      <div className={cn('flex-1 overflow-auto', !isMultiView && 'h-full')}>
        <ErrorBoundary>
          <Suspense fallback={<PanelLoader />}>
            {renderContent(panel.section)}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function MultiViewContainer({
  renderContent,
  onSectionChange,
  className,
}: MultiViewContainerProps) {
  const { panels, isMultiViewEnabled, splitLayout, updatePanelSection } = useMultiView();

  // Handle section change - update panel section in multi-view, or call parent handler
  const handleSectionChange = (section: string, panelId?: string) => {
    if (isMultiViewEnabled && panelId) {
      updatePanelSection(panelId, section);
    } else {
      onSectionChange(section, panelId);
    }
  };

  // Single panel mode - render normally without split
  if (!isMultiViewEnabled || panels.length === 1) {
    const panel = panels[0];
    return (
      <div className={cn('h-full', className)}>
        <SinglePanelContent
          panel={panel}
          renderContent={renderContent}
          onSectionChange={handleSectionChange}
          isMultiView={false}
        />
      </div>
    );
  }

  // Multi-panel mode with resizable panels
  return (
    <div className={cn('h-full', className)}>
      <ResizablePanelGroup
        direction={splitLayout}
        className="h-full"
      >
        {panels.map((panel, index) => (
          <React.Fragment key={panel.id}>
            <ResizablePanel
              defaultSize={100 / panels.length}
              minSize={20}
              className="flex flex-col"
            >
              <SinglePanelContent
                panel={panel}
                renderContent={renderContent}
                onSectionChange={handleSectionChange}
                isMultiView={true}
              />
            </ResizablePanel>
            {index < panels.length - 1 && (
              <ResizableHandle withHandle />
            )}
          </React.Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
}
