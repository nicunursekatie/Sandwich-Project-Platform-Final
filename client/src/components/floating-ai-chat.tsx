import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle,
  Send,
  Loader2,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  BarChart3,
  Copy,
  Check,
  Image,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  chart?: ChartData | null;
  timestamp: Date;
}

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xKey?: string;
  yKey?: string;
  description?: string;
}

export type AIContextType = 'collections' | 'events' | 'impact-reports';

interface FloatingAIChatProps {
  contextType: AIContextType;
  contextData?: Record<string, any>;
  suggestedQuestions?: string[];
  title?: string;
  subtitle?: string;
}

const CHART_COLORS = ['#47B3CB', '#236383', '#FBAD3F', '#007E8C', '#A31C41', '#10B981', '#6366F1', '#F59E0B'];

const DEFAULT_QUESTIONS: Record<AIContextType, string[]> = {
  collections: [
    "Which host collected the most sandwiches?",
    "What's our average collection size?",
    "Show collections by month",
    "Which days have the most collections?",
  ],
  events: [
    "Which organizations have the most events?",
    "Show me events by category",
    "What's our monthly event trend?",
    "Which months are busiest?",
  ],
  'impact-reports': [
    "Show monthly sandwich trends",
    "Which categories collect the most?",
    "What's our average per event?",
    "Top organizations by sandwiches",
  ],
};

// Simple markdown renderer for AI responses
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(<ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1 my-2">{listItems}</ol>);
      } else {
        elements.push(<ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">{listItems}</ul>);
      }
      listItems = [];
      listType = null;
    }
  };

  const processInlineFormatting = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold">{boldMatch[1] || boldMatch[2]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={index} className="font-semibold text-gray-800 mt-3 mb-1">
          {processInlineFormatting(trimmedLine.slice(4))}
        </h4>
      );
    } else if (trimmedLine.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={index} className="font-bold text-gray-800 mt-3 mb-1">
          {processInlineFormatting(trimmedLine.slice(3))}
        </h3>
      );
    } else if (trimmedLine.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={index} className="font-bold text-gray-900 mt-3 mb-2 text-base">
          {processInlineFormatting(trimmedLine.slice(2))}
        </h2>
      );
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      const content = trimmedLine.replace(/^\d+\.\s/, '');
      listItems.push(<li key={index}>{processInlineFormatting(content)}</li>);
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      const content = trimmedLine.slice(2);
      listItems.push(<li key={index}>{processInlineFormatting(content)}</li>);
    } else if (trimmedLine === '') {
      flushList();
      elements.push(<div key={index} className="h-2" />);
    } else {
      flushList();
      elements.push(
        <p key={index} className="my-1">
          {processInlineFormatting(trimmedLine)}
        </p>
      );
    }
  });

  flushList();
  return <div className="text-sm leading-relaxed">{elements}</div>;
}

export function FloatingAIChat({
  contextType,
  contextData,
  suggestedQuestions,
  title = 'AI Assistant',
  subtitle = 'Ask questions about your data',
}: FloatingAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [copiedChartId, setCopiedChartId] = useState<string | null>(null);

  const questions = suggestedQuestions || DEFAULT_QUESTIONS[contextType];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          contextType,
          contextData,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          chart: data.chart,
          timestamp: new Date(),
        },
      ]);
      setShowSuggestions(false);
    },
    onError: () => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [
      ...prev,
      { role: 'user', content: userMessage, timestamp: new Date() },
    ]);
    setInputValue('');
    chatMutation.mutate(userMessage);
  };

  const handleSuggestionClick = (question: string) => {
    setMessages(prev => [
      ...prev,
      { role: 'user', content: question, timestamp: new Date() },
    ]);
    chatMutation.mutate(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const exportAsCSV = (chart: ChartData) => {
    const xKey = chart.xKey || 'name';
    const yKey = chart.yKey || 'value';
    const headers = [xKey, yKey].join(',');
    const rows = chart.data.map(row => `"${row[xKey]}",${row[yKey]}`).join('\n');
    const csvContent = `${headers}\n${rows}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chart.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'CSV Downloaded', description: `${chart.title} data exported successfully` });
  };

  const copyToClipboard = async (chart: ChartData, chartId: string) => {
    const xKey = chart.xKey || 'name';
    const yKey = chart.yKey || 'value';
    const headers = `${xKey}\t${yKey}`;
    const rows = chart.data.map(row => `${row[xKey]}\t${row[yKey]}`).join('\n');
    const content = `${headers}\n${rows}`;

    try {
      await navigator.clipboard.writeText(content);
      setCopiedChartId(chartId);
      setTimeout(() => setCopiedChartId(null), 2000);
      toast({ title: 'Copied to Clipboard', description: 'Data ready to paste into Excel or Google Sheets' });
    } catch {
      toast({ title: 'Copy Failed', description: 'Unable to copy to clipboard', variant: 'destructive' });
    }
  };

  const exportAsPNG = async (chart: ChartData, chartId: string) => {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;

    const svgElement = chartElement.querySelector('svg');
    if (!svgElement) {
      toast({ title: 'Export Failed', description: 'Could not find chart to export', variant: 'destructive' });
      return;
    }

    try {
      const svgClone = svgElement.cloneNode(true) as SVGElement;
      const bbox = svgElement.getBoundingClientRect();
      svgClone.setAttribute('width', String(bbox.width));
      svgClone.setAttribute('height', String(bbox.height));

      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', 'white');
      svgClone.insertBefore(bgRect, svgClone.firstChild);

      const svgData = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = bbox.width * 2;
        canvas.height = bbox.height * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, bbox.width, bbox.height);
          ctx.drawImage(img, 0, 0);

          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `${chart.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast({ title: 'PNG Downloaded', description: `${chart.title} chart exported successfully` });
        }
        URL.revokeObjectURL(svgUrl);
      };
      img.src = svgUrl;
    } catch {
      toast({ title: 'Export Failed', description: 'Unable to export chart as PNG', variant: 'destructive' });
    }
  };

  const renderChart = (chart: ChartData, messageIndex: number) => {
    const xKey = chart.xKey || 'name';
    const yKey = chart.yKey || 'value';
    const chartId = `floating-chart-${messageIndex}`;

    return (
      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">{chart.title}</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-[#47B3CB]"
              onClick={() => copyToClipboard(chart, chartId)}
              title="Copy data"
            >
              {copiedChartId === chartId ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-[#47B3CB]"
              onClick={() => exportAsCSV(chart)}
              title="Download CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-[#47B3CB]"
              onClick={() => exportAsPNG(chart, chartId)}
              title="Download PNG"
            >
              <Image className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div id={chartId}>
          <ResponsiveContainer width="100%" height={180}>
            {chart.type === 'bar' ? (
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey={yKey} fill="#47B3CB">
                  {chart.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : chart.type === 'line' ? (
              <LineChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey={yKey} stroke="#47B3CB" strokeWidth={2} />
              </LineChart>
            ) : (
              <PieChart>
                <Pie
                  data={chart.data}
                  dataKey={yKey}
                  nameKey={xKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={9}
                >
                  {chart.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
        {chart.description && (
          <p className="text-xs text-gray-500 mt-2 italic">{chart.description}</p>
        )}
      </div>
    );
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-[#47B3CB] to-[#236383] hover:from-[#236383] hover:to-[#47B3CB] z-50"
        size="icon"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card className="w-72 shadow-xl border-[#47B3CB]/30">
          <CardHeader className="py-2 px-3 flex flex-row items-center justify-between bg-gradient-to-r from-[#47B3CB] to-[#236383] text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium text-sm">{title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => setIsMinimized(false)}>
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Full chat panel
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="w-96 h-[500px] shadow-xl border-[#47B3CB]/30 flex flex-col">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-gradient-to-r from-[#47B3CB] to-[#236383] text-white rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div>
              <span className="font-semibold">{title}</span>
              <p className="text-xs text-white/80">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={clearConversation} title="Clear chat">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4" ref={scrollRef}>
            {messages.length === 0 && showSuggestions && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 text-center mb-4">
                  I can help you understand your data. Try asking:
                </p>
                {questions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full text-left justify-start items-start h-auto py-2 px-3 text-xs hover:bg-[#47B3CB]/10 hover:border-[#47B3CB]"
                    onClick={() => handleSuggestionClick(question)}
                    disabled={chatMutation.isPending}
                  >
                    <MessageCircle className="h-4 w-4 mr-2 flex-shrink-0 text-[#47B3CB] mt-0.5" />
                    <span className="text-gray-700 whitespace-normal break-words text-left leading-snug">{question}</span>
                  </Button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-[#47B3CB] text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    renderMarkdown(message.content)
                  )}
                </div>
                {message.chart && renderChart(message.chart, index)}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Analyzing data...</span>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="p-3 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your data..."
              className="flex-1 text-sm"
              disabled={chatMutation.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || chatMutation.isPending}
              size="icon"
              className="bg-[#47B3CB] hover:bg-[#236383]"
            >
              {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
