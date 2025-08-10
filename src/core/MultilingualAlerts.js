// src/core/MultilingualAlerts.js - Handles multilingual alert generation and delivery

const logger = require("../utils/logger");

class MultilingualAlerts {
  constructor(config = {}) {
    this.config = {
      supportedLanguages: config.alertLanguages || ["en", "es", "fr"],
      primaryLanguage: config.primaryLanguage || "en",
      elevenLabsApiKey: config.elevenLabsApiKey,
      enableTTS: config.enableTTS !== false,
      alertTypes: config.alertTypes || ["text", "audio"],
    };

    this.alertTemplates = this.loadAlertTemplates();
    this.voiceSettings = this.loadVoiceSettings();
  }

  async initialize() {
    logger.info("Initializing multilingual alert system...");

    // Validate supported languages
    this.validateLanguageSupport();

    // Test TTS if enabled
    if (this.config.enableTTS) {
      await this.testTTSService();
    }

    logger.info(
      `Multilingual alerts ready for languages: ${this.config.supportedLanguages.join(", ")}`
    );
  }

  generateAlert(detection, language = "en", alertType = "discreet") {
    logger.debug(
      `Generating ${alertType} alert in ${language} for risk level: ${detection.riskLevel}`
    );

    // Ensure language is supported
    if (!this.config.supportedLanguages.includes(language)) {
      logger.warn(
        `Language ${language} not supported, falling back to ${this.config.primaryLanguage}`
      );
      language = this.config.primaryLanguage;
    }

    const template = this.getAlertTemplate(
      detection.riskLevel,
      language,
      alertType
    );
    const personalizedAlert = this.personalizeAlert(template, detection);

    return {
      language,
      type: alertType,
      riskLevel: detection.riskLevel,
      message: personalizedAlert,
      timestamp: new Date().toISOString(),
      audioRequired:
        this.config.enableTTS && this.config.alertTypes.includes("audio"),
    };
  }

  async generateAudioAlert(alertData) {
    if (!this.config.enableTTS) {
      throw new Error("Text-to-speech is disabled");
    }

    logger.debug(`Generating audio alert in ${alertData.language}`);

    try {
      const voiceConfig = this.voiceSettings[alertData.language];
      const audioBuffer = await this.synthesizeSpeech(
        alertData.message,
        voiceConfig
      );

      return {
        ...alertData,
        audioBuffer,
        audioFormat: "mp3",
        duration: this.estimateAudioDuration(alertData.message),
      };
    } catch (error) {
      logger.error("Failed to generate audio alert:", error);
      throw error;
    }
  }

  getAlertTemplate(riskLevel, language, alertType) {
    const templates = this.alertTemplates[language];

    if (!templates) {
      logger.warn(`No templates found for language: ${language}`);
      return this.alertTemplates[this.config.primaryLanguage][riskLevel][
        alertType
      ];
    }

    return templates[riskLevel][alertType] || templates["MEDIUM"][alertType];
  }

  personalizeAlert(template, detection) {
    let message = template;

    // Replace placeholders with actual detection data
    const placeholders = {
      "{riskLevel}": this.translateRiskLevel(detection.riskLevel, template),
      "{confidence}": `${Math.round(detection.confidence * 100)}%`,
      "{detectionType}": this.getDetectionTypeDescription(detection, template),
      "{timestamp}": new Date().toLocaleTimeString(),
      "{urgency}": this.getUrgencyLevel(detection.riskLevel),
    };

    for (const [placeholder, value] of Object.entries(placeholders)) {
      message = message.replace(new RegExp(placeholder, "g"), value);
    }

    return message;
  }

  translateRiskLevel(riskLevel, templateLanguage) {
    const riskTranslations = {
      en: {
        LOW: "low risk",
        MEDIUM: "moderate risk",
        HIGH: "high risk",
        CRITICAL: "critical risk",
        MAXIMUM: "maximum risk",
      },
      es: {
        LOW: "riesgo bajo",
        MEDIUM: "riesgo moderado",
        HIGH: "riesgo alto",
        CRITICAL: "riesgo crítico",
        MAXIMUM: "riesgo máximo",
      },
      fr: {
        LOW: "risque faible",
        MEDIUM: "risque modéré",
        HIGH: "risque élevé",
        CRITICAL: "risque critique",
        MAXIMUM: "risque maximum",
      },
    };

    // Detect language from template
    const language = this.detectTemplateLanguage(templateLanguage);
    return riskTranslations[language]?.[riskLevel] || riskLevel.toLowerCase();
  }

  getDetectionTypeDescription(detection, templateLanguage) {
    const language = this.detectTemplateLanguage(templateLanguage);

    const descriptions = {
      en: {
        phone_verification: "known scammer number",
        deepfake_detection: "synthetic voice",
        content_analysis: "suspicious content",
        combined: "multiple risk factors",
      },
      es: {
        phone_verification: "número conocido de estafador",
        deepfake_detection: "voz sintética",
        content_analysis: "contenido sospechoso",
        combined: "múltiples factores de riesgo",
      },
      fr: {
        phone_verification: "numéro d'escroc connu",
        deepfake_detection: "voix synthétique",
        content_analysis: "contenu suspect",
        combined: "multiples facteurs de risque",
      },
    };

    // Determine primary detection type
    let detectionType = "combined";
    if (detection.type) {
      detectionType = detection.type;
    } else if (detection.factors?.length === 1) {
      detectionType = detection.factors[0].type;
    }

    return (
      descriptions[language]?.[detectionType] ||
      descriptions["en"][detectionType]
    );
  }

  getUrgencyLevel(riskLevel) {
    const urgencyMap = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
      MAXIMUM: 5,
    };
    return urgencyMap[riskLevel] || 2;
  }

  detectTemplateLanguage(template) {
    // Simple language detection based on common words
    if (/\b(potentially|suspicious|detected|warning)\b/i.test(template))
      return "en";
    if (/\b(potencialmente|sospechoso|detectado|advertencia)\b/i.test(template))
      return "es";
    if (/\b(potentiellement|suspect|détecté|avertissement)\b/i.test(template))
      return "fr";
    return this.config.primaryLanguage;
  }

  async synthesizeSpeech(text, voiceConfig) {
    // This would integrate with ElevenLabs or another TTS service
    // For now, return a placeholder implementation

    logger.debug(
      `Synthesizing speech: "${text.substring(0, 50)}..." with voice: ${voiceConfig.voice}`
    );

    try {
      // Placeholder for actual TTS implementation
      // In a real implementation, this would call the ElevenLabs API
      const audioBuffer = Buffer.from("placeholder_audio_data");
      return audioBuffer;
    } catch (error) {
      logger.error("TTS synthesis failed:", error);
      throw new Error(`Failed to synthesize speech: ${error.message}`);
    }
  }

  estimateAudioDuration(text) {
    // Rough estimation: ~150 words per minute for natural speech
    const wordCount = text.split(" ").length;
    const duration = (wordCount / 150) * 60; // seconds
    return Math.max(duration, 2); // Minimum 2 seconds
  }

  validateLanguageSupport() {
    const supported = ["en", "es", "fr"];
    const invalid = this.config.supportedLanguages.filter(
      (lang) => !supported.includes(lang)
    );

    if (invalid.length > 0) {
      logger.warn(`Unsupported languages detected: ${invalid.join(", ")}`);
      this.config.supportedLanguages = this.config.supportedLanguages.filter(
        (lang) => supported.includes(lang)
      );
    }

    if (this.config.supportedLanguages.length === 0) {
      this.config.supportedLanguages = ["en"];
      logger.warn("No supported languages found, defaulting to English");
    }
  }

  async testTTSService() {
    try {
      const testText = "Test alert message";
      const voiceConfig = this.voiceSettings[this.config.primaryLanguage];
      await this.synthesizeSpeech(testText, voiceConfig);
      logger.info("TTS service test successful");
    } catch (error) {
      logger.warn(
        "TTS service test failed, audio alerts may not work:",
        error.message
      );
    }
  }

  loadAlertTemplates() {
    return {
      en: {
        LOW: {
          discreet:
            "Caution: This call shows {riskLevel} indicators. Please be aware of any unusual requests.",
          direct:
            "Warning: This call has been flagged for {detectionType}. Confidence: {confidence}.",
          detailed:
            "Security Alert: This call shows {riskLevel} based on {detectionType}. Confidence level: {confidence}. Please exercise caution with any personal information requests.",
        },
        MEDIUM: {
          discreet:
            "Advisory: This call shows suspicious patterns. Please be cautious with personal information.",
          direct:
            "Alert: {detectionType} detected with {confidence} confidence. Exercise caution.",
          detailed:
            "Security Advisory: This call has been flagged for {detectionType} with {confidence} confidence. Please be very cautious about sharing personal or financial information.",
        },
        HIGH: {
          discreet:
            "Important: This call appears suspicious. Avoid sharing personal information.",
          direct:
            "High Risk Alert: {detectionType} detected. Strong caution advised.",
          detailed:
            "High Risk Security Alert: This call shows strong indicators of {detectionType} with {confidence} confidence. Avoid sharing any personal, financial, or sensitive information.",
        },
        CRITICAL: {
          discreet:
            "Warning: This call is likely fraudulent. Consider ending the call.",
          direct:
            "Critical Alert: Likely scam call detected. End call recommended.",
          detailed:
            "Critical Security Warning: This call shows very strong indicators of fraudulent activity ({detectionType}, {confidence} confidence). We strongly recommend ending this call immediately.",
        },
      },
      es: {
        LOW: {
          discreet:
            "Precaución: Esta llamada muestra indicadores de {riskLevel}. Tenga cuidado con solicitudes inusuales.",
          direct:
            "Advertencia: Esta llamada ha sido marcada por {detectionType}. Confianza: {confidence}.",
          detailed:
            "Alerta de Seguridad: Esta llamada muestra {riskLevel} basado en {detectionType}. Nivel de confianza: {confidence}. Tenga precaución con solicitudes de información personal.",
        },
        MEDIUM: {
          discreet:
            "Aviso: Esta llamada muestra patrones sospechosos. Sea cauteloso con información personal.",
          direct:
            "Alerta: {detectionType} detectado con {confidence} de confianza. Ejerza precaución.",
          detailed:
            "Aviso de Seguridad: Esta llamada ha sido marcada por {detectionType} con {confidence} de confianza. Sea muy cauteloso al compartir información personal o financiera.",
        },
        HIGH: {
          discreet:
            "Importante: Esta llamada parece sospechosa. Evite compartir información personal.",
          direct:
            "Alerta de Alto Riesgo: {detectionType} detectado. Se recomienda mucha precaución.",
          detailed:
            "Alerta de Seguridad de Alto Riesgo: Esta llamada muestra fuertes indicadores de {detectionType} con {confidence} de confianza. Evite compartir información personal, financiera o sensible.",
        },
        CRITICAL: {
          discreet:
            "Advertencia: Esta llamada es probablemente fraudulenta. Considere terminar la llamada.",
          direct:
            "Alerta Crítica: Llamada de estafa detectada. Se recomienda terminar la llamada.",
          detailed:
            "Advertencia Crítica de Seguridad: Esta llamada muestra indicadores muy fuertes de actividad fraudulenta ({detectionType}, {confidence} de confianza). Recomendamos encarecidamente terminar esta llamada inmediatamente.",
        },
      },
      fr: {
        LOW: {
          discreet:
            "Attention: Cet appel présente des indicateurs de {riskLevel}. Soyez vigilant face aux demandes inhabituelles.",
          direct:
            "Avertissement: Cet appel a été signalé pour {detectionType}. Confiance: {confidence}.",
          detailed:
            "Alerte de Sécurité: Cet appel présente un {riskLevel} basé sur {detectionType}. Niveau de confiance: {confidence}. Soyez prudent avec les demandes d'informations personnelles.",
        },
        MEDIUM: {
          discreet:
            "Avis: Cet appel présente des motifs suspects. Soyez prudent avec les informations personnelles.",
          direct:
            "Alerte: {detectionType} détecté avec {confidence} de confiance. Exercez la prudence.",
          detailed:
            "Avis de Sécurité: Cet appel a été signalé pour {detectionType} avec {confidence} de confiance. Soyez très prudent lors du partage d'informations personnelles ou financières.",
        },
        HIGH: {
          discreet:
            "Important: Cet appel semble suspect. Évitez de partager des informations personnelles.",
          direct:
            "Alerte Haut Risque: {detectionType} détecté. Prudence élevée conseillée.",
          detailed:
            "Alerte de Sécurité Haut Risque: Cet appel présente de forts indicateurs de {detectionType} avec {confidence} de confiance. Évitez de partager toute information personnelle, financière ou sensible.",
        },
        CRITICAL: {
          discreet:
            "Avertissement: Cet appel est probablement frauduleux. Considérez mettre fin à l'appel.",
          direct:
            "Alerte Critique: Appel d'arnaque détecté. Fin d'appel recommandée.",
          detailed:
            "Avertissement Critique de Sécurité: Cet appel présente de très forts indicateurs d'activité frauduleuse ({detectionType}, {confidence} de confiance). Nous recommandons fortement de mettre fin à cet appel immédiatement.",
        },
      },
    };
  }

  loadVoiceSettings() {
    return {
      en: {
        voice: "rachel", // ElevenLabs voice ID
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.2,
        speakingRate: 1.0,
      },
      es: {
        voice: "maria", // Spanish voice
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.2,
        speakingRate: 0.95,
      },
      fr: {
        voice: "charlotte", // French voice
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.2,
        speakingRate: 0.95,
      },
    };
  }

  // Public API methods
  getSupportedLanguages() {
    return this.config.supportedLanguages;
  }

  getAlertTypes() {
    return this.config.alertTypes;
  }

  getLanguageStats() {
    return {
      supported: this.config.supportedLanguages,
      primary: this.config.primaryLanguage,
      ttsEnabled: this.config.enableTTS,
      templateCount: Object.keys(this.alertTemplates).length,
    };
  }
}

module.exports = MultilingualAlerts;
