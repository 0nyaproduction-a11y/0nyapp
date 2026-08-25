import {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  MobileAds,
} from "react-native-google-mobile-ads";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AdMobContextValue = {
  bootstrapError: string | null;
  canRequestAds: boolean;
  isBootstrapping: boolean;
  isInitialized: boolean;
  privacyOptionsRequired: boolean;
  showPrivacyChoices: () => Promise<void>;
};

const AdMobContext = createContext<AdMobContextValue | null>(null);

let mobileAdsInitializationPromise: Promise<void> | null = null;

function initializeMobileAds() {
  if (!mobileAdsInitializationPromise) {
    mobileAdsInitializationPromise = MobileAds()
      .initialize()
      .then(() => undefined)
      .catch((error) => {
        mobileAdsInitializationPromise = null;
        throw error;
      });
  }

  return mobileAdsInitializationPromise;
}

export function AdMobProvider({ children }: { children: ReactNode }) {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [canRequestAds, setCanRequestAds] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await AdsConsent.requestInfoUpdate();
        await AdsConsent.loadAndShowConsentFormIfRequired();
        const consentInfo = await AdsConsent.getConsentInfo();

        if (!active) {
          return;
        }

        setCanRequestAds(consentInfo.canRequestAds);
        setPrivacyOptionsRequired(
          consentInfo.privacyOptionsRequirementStatus ===
            AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        );

        if (consentInfo.canRequestAds) {
          await initializeMobileAds();

          if (active) {
            setIsInitialized(true);
          }
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to prepare Google Mobile Ads.";
        console.warn(message);
        setBootstrapError(message);
        setCanRequestAds(true);
        setPrivacyOptionsRequired(false);

        try {
          await initializeMobileAds();

          if (active) {
            setIsInitialized(true);
          }
        } catch (initError) {
          if (!active) {
            return;
          }

          const initMessage =
            initError instanceof Error
              ? initError.message
              : "Unable to initialize Google Mobile Ads.";
          console.warn(initMessage);
          setBootstrapError(initMessage);
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const showPrivacyChoices = useCallback(async () => {
    try {
      await AdsConsent.showPrivacyOptionsForm();
      const consentInfo = await AdsConsent.getConsentInfo();

      setCanRequestAds(consentInfo.canRequestAds);
      setPrivacyOptionsRequired(
        consentInfo.privacyOptionsRequirementStatus ===
          AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
      );

      if (consentInfo.canRequestAds) {
        await initializeMobileAds();
        setIsInitialized(true);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open privacy choices.";
      console.warn(message);
      setBootstrapError(message);
    }
  }, []);

  const value = useMemo<AdMobContextValue>(
    () => ({
      bootstrapError,
      canRequestAds,
      isBootstrapping,
      isInitialized,
      privacyOptionsRequired,
      showPrivacyChoices,
    }),
    [
      bootstrapError,
      canRequestAds,
      isBootstrapping,
      isInitialized,
      privacyOptionsRequired,
      showPrivacyChoices,
    ],
  );

  return <AdMobContext.Provider value={value}>{children}</AdMobContext.Provider>;
}

export function useAdMob() {
  const context = useContext(AdMobContext);

  if (!context) {
    throw new Error("useAdMob must be used inside AdMobProvider.");
  }

  return context;
}
