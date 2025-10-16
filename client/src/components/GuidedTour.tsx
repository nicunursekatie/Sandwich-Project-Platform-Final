import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import {
  HelpCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  FolderOpen,
  Calendar,
  BarChart3,
  ListTodo,
  Users,
  PlayCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  TOURS,
  TOUR_CATEGORIES,
  getToursByCategory,
  searchTours,
  getTourById,
  type Tour,
  type TourStep,
  type TourCategory,
} from '@/lib/tourDefinitions';

const CATEGORY_ICONS: Record<string, any> = {
  FolderOpen,
  Calendar,
  BarChart3,
  ListTodo,
  Users,
};

interface GuidedTourProps {
  onClose?: () => void;
}

export function GuidedTour({ onClose }: GuidedTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TourCategory | null>(null);
  const [completedTours, setCompletedTours] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  // Load completed tours from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('guided-tour-completed');
    if (stored) {
      try {
        setCompletedTours(JSON.parse(stored));
      } catch (e) {
        logger.error('Failed to load completed tours:', e);
      }
    }
  }, []);

  // Save completed tours to localStorage
  const markTourCompleted = useCallback((tourId: string) => {
    setCompletedTours(prev => {
      const updated = [...prev, tourId];
      localStorage.setItem('guided-tour-completed', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Save tour progress
  useEffect(() => {
    if (activeTour) {
      localStorage.setItem('guided-tour-active', JSON.stringify({
        tourId: activeTour.id,
        stepIndex: currentStepIndex,
      }));
    } else {
      localStorage.removeItem('guided-tour-active');
    }
  }, [activeTour, currentStepIndex]);

  const currentStep = activeTour?.steps[currentStepIndex];

  // Highlight target element
  useEffect(() => {
    if (!currentStep || !activeTour) return;

    const highlightElement = () => {
      const target = document.querySelector(currentStep.targetSelector);
      if (target && spotlightRef.current) {
        const rect = target.getBoundingClientRect();
        const padding = currentStep.highlightPadding || 8;
        
        spotlightRef.current.style.top = `${rect.top - padding}px`;
        spotlightRef.current.style.left = `${rect.left - padding}px`;
        spotlightRef.current.style.width = `${rect.width + padding * 2}px`;
        spotlightRef.current.style.height = `${rect.height + padding * 2}px`;
        spotlightRef.current.style.opacity = '1';
      }
    };

    // Execute beforeShow action if exists
    if (currentStep.beforeShow) {
      currentStep.beforeShow();
    }

    // Delay to allow DOM updates
    setTimeout(highlightElement, 300);
    
    // Re-highlight on scroll/resize
    window.addEventListener('scroll', highlightElement, true);
    window.addEventListener('resize', highlightElement);
    
    return () => {
      window.removeEventListener('scroll', highlightElement, true);
      window.removeEventListener('resize', highlightElement);
    };
  }, [currentStep, activeTour]);

  // Keyboard navigation
  useEffect(() => {
    if (!activeTour) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTour();
      } else if (e.key === 'ArrowRight' && currentStepIndex < activeTour.steps.length - 1) {
        nextStep();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        previousStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTour, currentStepIndex]);

  const startTour = useCallback((tour: Tour) => {
    setActiveTour(tour);
    setCurrentStepIndex(0);
    setShowMenu(false);
    
    // Navigate if needed
    const firstStep = tour.steps[0];
    if (firstStep.navigationAction) {
      const { section } = firstStep.navigationAction;
      const navButton = document.querySelector(`[data-nav-id="${section}"]`);
      if (navButton instanceof HTMLElement) {
        navButton.click();
      }
    }
  }, []);

  const nextStep = useCallback(() => {
    if (!activeTour) return;
    
    if (currentStepIndex < activeTour.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextStepData = activeTour.steps[nextIndex];
      
      // Navigate if needed
      if (nextStepData.navigationAction) {
        const { section } = nextStepData.navigationAction;
        const navButton = document.querySelector(`[data-nav-id="${section}"]`);
        if (navButton instanceof HTMLElement) {
          navButton.click();
        }
      }
      
      setCurrentStepIndex(nextIndex);
    } else {
      // Tour completed
      markTourCompleted(activeTour.id);
      closeTour();
    }
  }, [activeTour, currentStepIndex, markTourCompleted]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const closeTour = useCallback(() => {
    setActiveTour(null);
    setCurrentStepIndex(0);
    if (spotlightRef.current) {
      spotlightRef.current.style.opacity = '0';
    }
  }, []);

  const toggleMenu = useCallback(() => {
    setShowMenu(prev => !prev);
    setIsOpen(prev => !prev);
  }, []);

  const filteredTours = searchQuery
    ? searchTours(searchQuery)
    : selectedCategory
      ? getToursByCategory(selectedCategory)
      : TOURS;

  const isTourCompleted = (tourId: string) => completedTours.includes(tourId);

  return (
    <>
      {/* Floating Help Button */}
      <Button
        onClick={toggleMenu}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl z-50",
          "bg-gradient-to-br from-[#236383] to-[#007e8c] hover:from-[#1a4d66] hover:to-[#006270]",
          "text-white transition-all duration-300 hover:scale-110 active:scale-95",
          "border-2 border-white/20"
        )}
        aria-label="Open guided tour"
        data-testid="tour-help-button"
      >
        <HelpCircle className="w-7 h-7" />
      </Button>

      {/* Tour Menu */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={toggleMenu}
        >
          <Card
            className="fixed bottom-24 right-6 w-[440px] max-w-[calc(100vw-3rem)] shadow-2xl z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="pb-4 bg-gradient-to-r from-[#236383] to-[#007e8c] text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-6 h-6" />
                  <CardTitle className="text-xl">What are you looking for?</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMenu}
                  className="text-white hover:bg-white/20"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              {/* Search */}
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <Input
                  placeholder="Search tours..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  data-testid="tour-search"
                />
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Categories */}
              {!searchQuery && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs"
                  >
                    All Tours
                  </Button>
                  {Object.entries(TOUR_CATEGORIES).map(([key, category]) => {
                    const IconComponent = CATEGORY_ICONS[category.icon];
                    return (
                      <Button
                        key={key}
                        variant={selectedCategory === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(key as TourCategory)}
                        className="text-xs"
                      >
                        {IconComponent && <IconComponent className="w-3 h-3 mr-1" />}
                        {category.label}
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Tour List */}
              <ScrollArea className="h-[320px] pr-4">
                <div className="space-y-2">
                  {filteredTours.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No tours found. Try a different search.
                    </p>
                  ) : (
                    filteredTours.map((tour) => {
                      const isCompleted = isTourCompleted(tour.id);
                      return (
                        <button
                          key={tour.id}
                          onClick={() => startTour(tour)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            "hover:border-[#236383] hover:bg-[#236383]/5",
                            "focus:outline-none focus:ring-2 focus:ring-[#236383]/50",
                            isCompleted && "bg-green-50 border-green-200"
                          )}
                          data-testid={`tour-${tour.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-sm truncate">
                                  {tour.title}
                                </h3>
                                {isCompleted && (
                                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {tour.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-[#007e8c]/10 text-[#007e8c] hover:bg-[#007e8c]/20"
                                >
                                  {TOUR_CATEGORIES[tour.category].label}
                                </Badge>
                                {tour.estimatedTime && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {tour.estimatedTime}
                                  </span>
                                )}
                              </div>
                            </div>
                            <PlayCircle className="w-5 h-5 text-[#236383] flex-shrink-0 mt-1" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Tour Overlay */}
      {activeTour && currentStep && (
        <>
          {/* Dark Overlay */}
          <div
            ref={overlayRef}
            className="fixed inset-0 bg-black/60 z-[60] transition-opacity pointer-events-none"
            aria-hidden="true"
          />

          {/* Spotlight */}
          <div
            ref={spotlightRef}
            className="fixed z-[61] pointer-events-none transition-all duration-300 rounded-lg"
            style={{
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              opacity: 0,
            }}
            aria-hidden="true"
          />

          {/* Tour Step Card */}
          <div className="fixed inset-0 z-[62] flex items-center justify-center p-4 pointer-events-none">
            <Card
              className={cn(
                "w-full max-w-lg shadow-2xl pointer-events-auto",
                "bg-white border-2 border-[#fbad3f]",
                currentStep.position === 'top' && "mb-auto mt-20",
                currentStep.position === 'bottom' && "mt-auto mb-20",
                currentStep.position === 'left' && "mr-auto ml-20",
                currentStep.position === 'right' && "ml-auto mr-20"
              )}
              role="dialog"
              aria-labelledby="tour-step-title"
              aria-describedby="tour-step-description"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-[#236383] text-white">
                        Step {currentStepIndex + 1} of {activeTour.steps.length}
                      </Badge>
                      <Badge variant="outline" className="text-[#007e8c] border-[#007e8c]">
                        {activeTour.title}
                      </Badge>
                    </div>
                    <CardTitle id="tour-step-title" className="text-xl text-[#236383]">
                      {currentStep.title}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeTour}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close tour"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <p id="tour-step-description" className="text-sm text-muted-foreground mb-6">
                  {currentStep.description}
                </p>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#236383] to-[#007e8c] transition-all duration-300"
                      style={{
                        width: `${((currentStepIndex + 1) / activeTour.steps.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={closeTour}
                    className="flex-1"
                    data-testid="tour-skip"
                  >
                    Skip Tour
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={previousStep}
                      disabled={currentStepIndex === 0}
                      className="px-3"
                      aria-label="Previous step"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      onClick={nextStep}
                      className="bg-gradient-to-r from-[#236383] to-[#007e8c] hover:from-[#1a4d66] hover:to-[#006270] text-white px-6"
                      data-testid="tour-next"
                    >
                      {currentStepIndex === activeTour.steps.length - 1 ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Keyboard Hints */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-muted-foreground text-center">
                    Use <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">←</kbd> <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">→</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">ESC</kbd> to close
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
