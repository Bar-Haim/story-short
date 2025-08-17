'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIAssistantProps {
  videoStatus?: string;
  onAction?: (action: string) => void;
  className?: string;
}

interface AssistantMessage {
  id: string;
  type: 'suggestion' | 'question' | 'info';
  text: string;
  action?: string;
  actionLabel?: string;
}

export default function AIAssistant({ videoStatus, onAction, className = '' }: AIAssistantProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate contextual messages based on video status
  useEffect(() => {
    const newMessages: AssistantMessage[] = [];
    
    switch (videoStatus) {
      case 'script_generated':
        newMessages.push({
          id: '1',
          type: 'suggestion',
          text: "Great! Your script is ready. Would you like me to split it into scenes for your storyboard?",
          action: 'generate_storyboard',
          actionLabel: 'Create Storyboard'
        });
        break;
        
      case 'storyboard_generated':
        newMessages.push({
          id: '2',
          type: 'suggestion',
          text: "Your storyboard is complete! Ready to generate images, audio, and captions?",
          action: 'generate_assets',
          actionLabel: 'Generate Assets'
        });
        break;
        
      case 'assets_generated':
        newMessages.push({
          id: '3',
          type: 'suggestion',
          text: "All assets are ready! Time to render your final video with FFmpeg.",
          action: 'render_video',
          actionLabel: 'Render Video'
        });
        break;
        
      case 'completed':
        newMessages.push({
          id: '4',
          type: 'info',
          text: "🎉 Your video is complete! You can now download, share, or create a new one.",
          action: 'download_video',
          actionLabel: 'Download Video'
        });
        break;
        
      case 'failed':
        newMessages.push({
          id: '5',
          type: 'question',
          text: "Something went wrong. Would you like to retry the generation or start over?",
          action: 'retry_generation',
          actionLabel: 'Retry'
        });
        break;
        
      default:
        newMessages.push({
          id: '6',
          type: 'info',
          text: "Hi! I'm your AI assistant. I'll help you create amazing videos. Start by entering your story idea!",
        });
    }
    
    setMessages(newMessages);
    setIsVisible(true);
  }, [videoStatus]);

  const handleAction = (action: string) => {
    if (onAction) {
      onAction(action);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 mb-4 w-80 max-w-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                🤖 AI Assistant
              </h3>
              <button
                onClick={handleToggle}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`p-3 rounded-lg ${
                    message.type === 'suggestion' 
                      ? 'bg-blue-50 border border-blue-200' 
                      : message.type === 'question'
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <p className="text-sm text-gray-700 mb-2">{message.text}</p>
                  {message.action && message.actionLabel && (
                    <button
                      onClick={() => handleAction(message.action!)}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      {message.actionLabel}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-4">
                I&apos;m here to help you create amazing videos! Ask me anything about:
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Floating action button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggle}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
      >
        {isExpanded ? '✕' : '🤖'}
      </motion.button>
    </div>
  );
} 