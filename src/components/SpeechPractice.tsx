import React, { useState, useEffect } from 'react';
import { tokenizeSentence } from '../lib/sentenceBuilder';

interface SpeechPracticeProps {
  targetSentence: string;
  onComplete?: (success: boolean) => void;
}

const SpeechPractice: React.FC<SpeechPracticeProps> = ({ targetSentence, onComplete }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognitionAPI();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
        checkMatch(transcriptText);
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setFeedback(`Error: ${event.error}`);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const checkMatch = (spokenText: string) => {
    const normalizedSpoken = spokenText.toLowerCase().trim();
    const normalizedTarget = targetSentence.toLowerCase().trim();

    if (normalizedSpoken === normalizedTarget) {
      setFeedback('Perfect! 🎉');
      onComplete?.(true);
    } else {
      const similarity = calculateSimilarity(normalizedSpoken, normalizedTarget);
      if (similarity > 0.8) {
        setFeedback('Very close! Try again.');
      } else {
        setFeedback('Not quite. Listen to the target and try again.');
      }
      onComplete?.(false);
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = tokenizeSentence(str1);
    const words2 = tokenizeSentence(str2);
    const matches = words1.filter((word) => words2.includes(word)).length;
    return matches / Math.max(words1.length, words2.length);
  };

  const startListening = () => {
    if (recognition) {
      setTranscript('');
      setFeedback(null);
      recognition.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const speakTarget = () => {
    const utterance = new SpeechSynthesisUtterance(targetSentence);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  if (!recognition) {
    return (
      <div className="speech-practice-error">
        <p>Speech recognition is not supported in your browser.</p>
      </div>
    );
  }

  return (
    <div className="speech-practice-container">
      <div className="target-sentence">
        <h3>Target Sentence:</h3>
        <p>{targetSentence}</p>
        <button onClick={speakTarget} className="btn-listen">
          🔊 Listen
        </button>
      </div>

      <div className="practice-controls">
        {!isListening ? (
          <button onClick={startListening} className="btn-start">
            🎤 Start Speaking
          </button>
        ) : (
          <button onClick={stopListening} className="btn-stop">
            ⏹ Stop
          </button>
        )}
      </div>

      {transcript && (
        <div className="transcript">
          <h4>You said:</h4>
          <p>{transcript}</p>
        </div>
      )}

      {feedback && (
        <div className={`feedback ${feedback.includes('Perfect') ? 'success' : 'info'}`}>
          {feedback}
        </div>
      )}
    </div>
  );
};

export default SpeechPractice;
