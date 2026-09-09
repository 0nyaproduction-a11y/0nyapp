const unavailableMessage = "Google Mobile Ads are unavailable in Expo Web QA.";

export const AdsConsentPrivacyOptionsRequirementStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  REQUIRED: "REQUIRED",
  UNKNOWN: "UNKNOWN",
};

export const AdsConsent = {
  async requestInfoUpdate() {
    return undefined;
  },
  async loadAndShowConsentFormIfRequired() {
    return undefined;
  },
  async getConsentInfo() {
    return {
      canRequestAds: false,
      privacyOptionsRequirementStatus:
        AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
    };
  },
  async showPrivacyOptionsForm() {
    throw new Error(unavailableMessage);
  },
};

export function MobileAds() {
  return {
    async initialize() {
      return undefined;
    },
  };
}

export const AdEventType = {
  CLOSED: "closed",
  ERROR: "error",
  OPENED: "opened",
};

export const RewardedAdEventType = {
  EARNED_REWARD: "rewarded_earned_reward",
  LOADED: "rewarded_loaded",
};

export const TestIds = {
  REWARDED: "web-unavailable-rewarded-ad",
};

export const RewardedAd = {
  createForAdRequest() {
    const listeners = new Map();

    function emit(type, payload) {
      const callbacks = listeners.get(type);
      if (!callbacks) {
        return;
      }

      for (const callback of callbacks) {
        callback(payload);
      }
    }

    return {
      addAdEventListener(type, callback) {
        const callbacks = listeners.get(type) ?? new Set();
        callbacks.add(callback);
        listeners.set(type, callbacks);

        return () => {
          callbacks.delete(callback);
        };
      },
      load() {
        queueMicrotask(() => {
          emit(AdEventType.ERROR, { message: unavailableMessage });
        });
      },
      removeAllListeners() {
        listeners.clear();
      },
      show() {
        throw new Error(unavailableMessage);
      },
    };
  },
};
