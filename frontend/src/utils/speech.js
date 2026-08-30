// Browser Speech-to-Text and Text-to-Speech utilities

let recognitionInstance = null;

/**
 * Initializes and starts browser speech recognition.
 * @param {Function} onTranscript Called with the final transcript text.
 * @param {Function} onError Called on recognition errors.
 * @param {Function} onEnd Called when recognition stops.
 */
export function startSpeechRecognition(onTranscript, onError, onEnd) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError(new Error('Speech recognition is not supported in this browser. Please try Google Chrome.'));
    onEnd();
    return null;
  }

  try {
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    let finalTranscript = '';

    recognitionInstance.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment;
        } else {
          interimTranscript += transcriptSegment;
        }
      }
      onTranscript(finalTranscript, interimTranscript);
    };

    recognitionInstance.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.warn('[Speech API] Microphone permission not allowed by browser.');
        onError(new Error('Microphone access not allowed. Please enable microphone permission in browser settings.'));
        return;
      }
      onError(event.error ? new Error(`Speech recognition error: ${event.error}`) : event);
    };

    recognitionInstance.onend = () => {
      onEnd();
      recognitionInstance = null;
    };

    recognitionInstance.start();
    return recognitionInstance;
  } catch (error) {
    onError(error);
    onEnd();
    return null;
  }
}

/**
 * Stops active speech recognition.
 */
export function stopSpeechRecognition() {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {
      console.error('Error stopping speech recognition:', e);
    }
    recognitionInstance = null;
  }
}

/**
 * Retrieves available TTS voices from the browser.
 * @returns {Array<SpeechSynthesisVoice>}
 */
export function getAvailableVoices() {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en') || v.lang.startsWith('hi'));
}

/**
 * Speaks text using the browser text-to-speech engine.
 * Strips markdown styling and bracket citations for clean pronunciation.
 * @param {string} text The text to speak.
 * @param {Function|Object} onEndOrOptions Callback when speech ends OR options object { rate, pitch, voiceIndex, onEnd }
 * @param {Function} optionalOnEnd Fallback callback
 */
export function speakText(text, onEndOrOptions = null, optionalOnEnd = null) {
  if (!window.speechSynthesis) {
    console.error('Text-to-speech is not supported in this browser.');
    if (typeof onEndOrOptions === 'function') onEndOrOptions();
    if (typeof optionalOnEnd === 'function') optionalOnEnd();
    return;
  }

  let onEnd = typeof onEndOrOptions === 'function' ? onEndOrOptions : optionalOnEnd;
  let rate = 1.05;
  let pitch = 1.0;
  let voiceIndex = null;

  if (typeof onEndOrOptions === 'object' && onEndOrOptions !== null) {
    if (onEndOrOptions.onEnd) onEnd = onEndOrOptions.onEnd;
    if (onEndOrOptions.rate) rate = parseFloat(onEndOrOptions.rate);
    if (onEndOrOptions.pitch) pitch = parseFloat(onEndOrOptions.pitch);
    if (onEndOrOptions.voiceIndex !== undefined) voiceIndex = onEndOrOptions.voiceIndex;
  }

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  // Clean text: strip markdown elements and bracket citations (e.g. [1])
  let cleanText = text
    .replace(/\[\d+\]/g, '') // remove [1], [22]
    .replace(/[#*`_~]/g, '') // remove markdown symbols
    .replace(/>\s*\[\!NOTE\]/gi, '') // remove callout tags
    .replace(/>\s*\[\!IMPORTANT\]/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '') // remove HTML tags if any (like <related>)
    .replace(/<related>[\s\S]*?<\/related>/gi, '') // remove related questions block
    .trim();

  // Truncate text if it is too long for a single utterance
  if (cleanText.length > 500) {
    cleanText = cleanText.substring(0, 500) + '... And more details are available in the written text response.';
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = rate;
  utterance.pitch = pitch;

  // Choose voice
  const voices = window.speechSynthesis.getVoices();
  if (voiceIndex !== null && voices[voiceIndex]) {
    utterance.voice = voices[voiceIndex];
  } else {
    const englishVoice = voices.find(v => v.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Cancels all current and pending speech synthesis.
 */
export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
