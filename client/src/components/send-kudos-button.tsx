import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { Heart, Star, Trophy, Sparkles, Target } from "lucide-react";

interface SendKudosButtonProps {
  recipientId: string;
  recipientName: string;
  contextType: "project" | "task";
  contextId: string;
  contextTitle: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline";
}

export default function SendKudosButton({
  recipientId,
  recipientName,
  contextType,
  contextId,
  contextTitle,
  className = "",
  size = "sm",
  variant = "outline"
}: SendKudosButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasSentKudos, setHasSentKudos] = useState(false);

  // Don't render if recipientId is empty or invalid
  if (!recipientId || !recipientId.trim()) {
    console.warn('SendKudosButton: Not rendering due to empty recipientId', {
      recipientId,
      recipientName,
      contextType,
      contextId,
      contextTitle
    });
    return null;
  }

  // Don't render if no user or trying to send kudos to yourself
  if (!user || (user as any)?.id === recipientId) {
    return null;
  }

  // Don't render if user doesn't have permission to send kudos
  if (!hasPermission(user, PERMISSIONS.SEND_KUDOS)) {
    console.warn('SendKudosButton: User lacks SEND_KUDOS permission', {
      user: user ? { id: (user as any).id, email: (user as any).email } : null,
      hasPermission: hasPermission(user, PERMISSIONS.SEND_KUDOS),
      SEND_KUDOS: PERMISSIONS.SEND_KUDOS
    });
    return null;
  }

  const sendKudosMutation = useMutation({
    mutationFn: async () => {
      const kudosMessage = generateKudosMessage(recipientName, contextType, contextTitle);
      
      // Debug logging
      console.log('SendKudosButton mutation data:', {
        recipientId,
        recipientName,
        contextType,
        contextId,
        entityName: contextTitle,
        content: kudosMessage
      });

      if (!recipientId || !recipientId.trim()) {
        console.error('SendKudosButton: Empty recipientId detected', {
          recipientId,
          recipientName,
          contextType,
          contextId,
          contextTitle
        });
        throw new Error(`Cannot send kudos: recipient ID is empty`);
      }
      
      return await apiRequest('POST', '/api/messaging/kudos', {
        recipientId,
        contextType,
        contextId,
        entityName: contextTitle,
        content: kudosMessage
      });
    },
    onSuccess: () => {
      setHasSentKudos(true);
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/kudos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/kudos/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-notifications/unread-counts"] });
      toast({
        description: `Kudos sent to ${recipientName}!`,
        duration: 3000
      });
    },
    onError: (error: any) => {
      // Check if it's a 409 error (kudos already sent)
      if (error?.response?.status === 409 || error?.status === 409) {
        setHasSentKudos(true);
        const message = error?.response?.data?.message || "Kudos already sent for this item!";
        toast({
          description: message,
          variant: "default"
        });
      } else {
        const errorMessage = error?.response?.data?.error || error?.message || "Failed to send kudos";
        toast({
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  });

  const generateKudosMessage = (name: string, type: string, title: string) => {
    const messages = [
      `🎉 Fantastic work on ${title}, ${name}! Your dedication really shows.`,
      `⭐ Great job completing ${title}! Thanks for your excellent contribution.`,
      `🏆 Outstanding work on ${title}, ${name}! Keep up the amazing effort.`,
      `✨ Excellent completion of ${title}! Your work makes a real difference.`,
      `🎯 Awesome job with ${title}, ${name}! Thanks for being such a valuable team member.`,
      `🌟 Brilliant work on ${title}! Your contribution is truly appreciated.`,
      `🚀 Amazing job completing ${title}, ${name}! Your effort doesn't go unnoticed.`,
      `💫 Wonderful work on ${title}! Thanks for your commitment to excellence.`
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getRandomIcon = () => {
    const icons = [Heart, Star, Trophy, Sparkles, Target];
    const IconComponent = icons[Math.floor(Math.random() * icons.length)];
    return <IconComponent className="h-3 w-3" />;
  };

  if (!user || (user as any).id === recipientId) {
    return null; // Don't show kudos button for yourself
  }

  if (hasSentKudos) {
    return (
      <Badge variant="secondary" className={`gap-1 ${className}`}>
        <Heart className="h-3 w-3 fill-red-400 text-red-400" />
        Kudos Sent
      </Badge>
    );
  }

  return (
    <Button
      onClick={() => sendKudosMutation.mutate()}
      disabled={sendKudosMutation.isPending}
      size={size}
      variant={variant}
      className={`gap-1 ${className}`}
    >
      {sendKudosMutation.isPending ? (
        <>
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
          Sending...
        </>
      ) : (
        <>
          {getRandomIcon()}
          Send Kudos to {recipientName}
        </>
      )}
    </Button>
  );
}